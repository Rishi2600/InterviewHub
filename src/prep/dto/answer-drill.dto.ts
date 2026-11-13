import { IsIn, IsMongoId } from 'class-validator';

export class AnswerDrillDto {
  @IsMongoId()
  questionId: string;

  @IsIn(['a', 'b', 'c', 'd'])
  optionId: string;
}
