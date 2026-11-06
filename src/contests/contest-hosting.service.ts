import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contest, ContestDocument } from './schemas/contest.schema';
import { AuthUser } from '../common/decorators/current-user.decorator';

/** The host side of a contest: drafts, the question editor, publishing and
 *  cancelling. */
@Injectable()
export class ContestHostingService {
  constructor(
    @InjectModel(Contest.name)
    private readonly contestModel: Model<ContestDocument>,
  ) {}

  createDraft(host: AuthUser, title: string): Promise<ContestDocument> {
    return this.contestModel.create({
      title,
      hostId: new Types.ObjectId(host.userId),
      hostName: host.username,
      status: 'draft',
    });
  }
}
