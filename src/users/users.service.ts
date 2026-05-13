import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { UserDocument } from './user.schema';
import { User } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async update(id: string, patch: Partial<Pick<User, 'email' | 'name'>>) {
    return this.userModel.findByIdAndUpdate(id, patch, { new: true }).exec();
  }

  async createProfileIfAbsent(params: { email: string; name?: string }) {
    const email = params.email.toLowerCase();
    return this.userModel
      .findOneAndUpdate(
        { email },
        { $setOnInsert: { email, name: params.name } },
        { upsert: true, new: true },
      )
      .exec();
  }
}
