import {
  cleanReply,
  conversation,
  draftReply,
  estimateTokens,
  feedbackRequest,
  overallScore,
  parseFeedback,
  REPLY_MAX_TOKENS,
  systemPrompt,
} from './prompts';
import { feedbackAreas } from './practice.constants';
import { Turn } from './schemas/practice-interview.schema';

const technical = {
  kind: 'technical' as const,
  topic: 'Python',
  mixed: false,
  level: 'mid' as const,
  minutes: 30,
  language: 'python' as const,
};
const at = new Date('2026-11-11T10:00:00Z');
const ai = (text: string): Turn => ({ kind: 'ai', text, at });
const answer = (text: string, code?: string): Turn => ({
  kind: 'candidate',
  text,
  at,
  minutesLeft: 20,
  answersLeft: 30,
  code,
});

/** A long interview: AI question, long answer, repeated. */
function longTurns(n: number): Turn[] {
  const turns: Turn[] = [];
  for (let i = 0; i < n; i++) {
    turns.push(ai(`Question ${i}: ${'why '.repeat(30)}`));
    turns.push(answer(`Answer ${i}: ${'because '.repeat(150)}`));
  }
  return turns;
}

describe('systemPrompt', () => {
  it('plans a coding question in the chosen language', () => {
    const p = systemPrompt(technical, []);
    expect(p).toContain('then one coding question in Python');
    expect(p).toContain('pose_coding_question');
    expect(p).toContain('Never write or fix their code');
  });

  it('has no coding part without a language', () => {
    const p = systemPrompt({ ...technical, language: null }, []);
    expect(p).toContain('There is no coding question');
    expect(p).not.toContain('pose_coding_question');
  });

  it('asks about past situations in a behavioural interview', () => {
    const p = systemPrompt(
      { ...technical, kind: 'behavioural', topic: 'Conflict', language: null },
      [],
    );
    expect(p).toContain('real situations');
    expect(p).toContain('what they did and the result');
  });

  it('names a random topic and recent questions to avoid', () => {
    const p = systemPrompt({ ...technical, mixed: true }, ['Decorators']);
    expect(p).toContain('picked at random');
    expect(p).toContain('pick different questions: Decorators.');
  });
});

describe('conversation', () => {
  it("sends the app's notes as plain system messages, never in brackets", () => {
    const msgs = conversation(
      {
        ...technical,
        turns: [
          ai('Write it.'),
          answer('Done', 'print(1)'),
          {
            kind: 'run',
            text: '',
            at,
            run: { input: 'aabb', output: '0', status: 'ok', ms: 38 },
          },
        ],
      },
      [],
    );
    expect(msgs.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
      'system',
      'system',
      'system',
    ]);
    expect(msgs[1].content).toBe("Hi, I'm ready to start.");
    expect(msgs[3].content).toBe('Done');
    expect(msgs[4].content).toContain('```python\nprint(1)\n```');
    expect(msgs[5].content).toContain('finished in 38 ms');
    expect(msgs[5].content).toContain('Input:\naabb\nOutput:\n0');
    expect(msgs.at(-1)?.content).toBe('Time left: 20 min. Answers left: 30.');
    // Nothing the app adds to the dialogue uses square brackets.
    for (const m of msgs.slice(1)) expect(m.content).not.toMatch(/\[[A-Z]/);
  });

  it('follows a tool call with its result', () => {
    const tool = { id: 'c1', name: 'end_interview', arguments: '{}' };
    const msgs = conversation(
      { ...technical, turns: [{ kind: 'ai', text: 'Bye', at, tool }] },
      [],
    );
    expect(msgs.slice(2, -1)).toEqual([
      { role: 'assistant', content: 'Bye', toolCalls: [tool] },
      { role: 'tool', content: 'Done.', toolCallId: 'c1' },
    ]);
  });

  it('stays under the per-minute token limit with the reply', () => {
    const msgs = conversation({ ...technical, turns: longTurns(40) }, []);
    expect(estimateTokens(msgs) + REPLY_MAX_TOKENS).toBeLessThan(8_000);
    expect(msgs[2].content).toContain('left out to save space');
  });

  it('drops old turns in blocks, so the prompt start holds for several turns', () => {
    const starts = [30, 31, 32, 33].map((n) => {
      const msgs = conversation({ ...technical, turns: longTurns(n) }, []);
      return msgs
        .slice(0, 5)
        .map((m) => m.content)
        .join('|');
    });
    // Most consecutive interviews share the same opening messages.
    const same = starts.filter((s, i) => i > 0 && s === starts[i - 1]).length;
    expect(same).toBeGreaterThanOrEqual(2);
  });
});

describe('feedback', () => {
  const areas = feedbackAreas('technical', true);

  it('keeps the request under the per-minute limit', () => {
    const req = feedbackRequest({ ...technical, turns: longTurns(40) });
    expect(estimateTokens(req.messages) + req.maxTokens).toBeLessThan(8_000);
    expect(req.json.schema).toMatchObject({ additionalProperties: false });
  });

  it('scores every area once, within 1 to 5', () => {
    const f = parseFeedback(
      JSON.stringify({
        summary: 'Solid.',
        areas: [
          { name: 'Knowledge', score: 9 },
          { name: 'Edge cases', score: 0 },
          { name: 'Made up', score: 5 },
        ],
        strengths: ['Clear', ''],
        improve: [{ point: 'Test more', detail: 'Empty input' }],
        questions: [
          {
            title: 'Tuples',
            score: 4,
            note: 'Good',
            tip: 'More',
            coding: false,
          },
        ],
      }),
      areas,
    );
    expect(f.areas.map((a) => a.name)).toEqual([...areas]);
    expect(f.areas[0].score).toBe(5);
    expect(f.areas.find((a) => a.name === 'Edge cases')?.score).toBe(1);
    expect(f.areas.find((a) => a.name === 'Communication')?.score).toBe(1);
    expect(f.strengths).toEqual(['Clear']);
    expect(overallScore(f)).toBe(1.8);
  });

  it('refuses feedback without a summary or scores', () => {
    expect(() =>
      parseFeedback(JSON.stringify({ summary: '', areas: [] }), areas),
    ).toThrow();
    expect(() => parseFeedback('not json', areas)).toThrow();
  });
});

describe('cleanReply', () => {
  const clean = (t: string) => cleanReply(t, false).text;

  it('drops bracketed remarks, and cuts where the AI plays the next turn', () => {
    expect(clean('What is a tuple? [0:39]')).toBe('What is a tuple?');
    expect(
      clean(
        'Thanks. Why? [15 min and 38 answers left.] What about generators?',
      ),
    ).toBe('Thanks. Why?');
    expect(clean('Go on. [12 min and 30 answers left.]')).toBe('Go on.');
    expect(clean('[Pauses] Good. What is a closure?')).toBe(
      'Good. What is a closure?',
    );
    expect(
      clean('Nice. [The candidate seems unsure.] Can you give an example?'),
    ).toBe('Nice. Can you give an example?');
    expect(
      clean(
        'What is a closure? [Candidate: It keeps variables.] Great. And decorators?',
      ),
    ).toBe('What is a closure?');
    expect(clean('Okay [waits for the answer]')).toBe('Okay');
  });

  it('leaves code alone', () => {
    expect(clean('Try a[1:3] first.')).toBe('Try a[1:3] first.');
    expect(clean('Look at items[0] first.')).toBe('Look at items[0] first.');
    expect(clean('Given [1, 2, 3], what prints?')).toBe(
      'Given [1, 2, 3], what prints?',
    );
    expect(clean('What does `[Note] x` print?')).toBe(
      'What does `[Note] x` print?',
    );
    expect(clean('See [the docs](https://docs.python.org).')).toBe(
      'See [the docs](https://docs.python.org).',
    );
  });

  it('keeps one turn of at most two questions', () => {
    expect(
      clean('Why is that?Thanks for the explanation. Next: what is a closure?'),
    ).toBe('Why is that?');
    expect(
      clean(
        'Could you give an example?A `@staticmethod` is best when it needs no class.',
      ),
    ).toBe('Could you give an example?');
    expect(clean('Run it again.How would you avoid the copy?')).toBe(
      'Run it again.',
    );
    expect(clean('Look at pathlib.Path and os.path first.')).toBe(
      'Look at pathlib.Path and os.path first.',
    );
    expect(clean('Is it O(n)? Why?')).toBe('Is it O(n)? Why?');
    expect(clean('What is X? Why? How would you test it? And Y?')).toBe(
      'What is X? Why?',
    );
  });

  it('lifts out a coding question written as JSON', () => {
    const json =
      '{"title":"Balanced brackets","statement":"Print YES or NO.","example_input":"()","example_output":"YES"}';
    const out = cleanReply(
      `Now the coding part.\n\n\`\`\`json\n${json}\n\`\`\`\n\nWrite it in Python.`,
      true,
    );
    expect(out.question).toBe(json);
    expect(out.text).toBe('Now the coding part.\n\nWrite it in Python.');
    // Without coding, the text is left alone.
    expect(
      cleanReply('```json\n{"title":"x","statement":"y"}\n```', false).question,
    ).toBeUndefined();
  });
});

describe('draftReply', () => {
  it('never shows a remark while it is still being written', () => {
    expect(draftReply('Good. [Pau')).toBe('Good.');
    expect(draftReply('Good. [Pauses] What')).toBe('Good. What');
    expect(draftReply('Why? [Candidate: becau')).toBe('Why?');
    expect(draftReply('Look at `items[0')).toBe('Look at `items[0');
    expect(draftReply('Here:\n```py\nx = [1')).toBe('Here:');
  });
});
