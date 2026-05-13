import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './role.schema';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleModel.find().exec();
  }

  async findById(id: string): Promise<Role | null> {
    return this.roleModel.findById(id).exec();
  }

  async create(roleData: {
    name: string;
    icon: string;
    description: string;
  }): Promise<Role> {
    const role = new this.roleModel(roleData);
    return role.save();
  }

  async update(
    id: string,
    roleData: {
      name?: string;
      icon?: string;
      description?: string;
    },
  ): Promise<Role | null> {
    return this.roleModel.findByIdAndUpdate(id, roleData, { new: true }).exec();
  }

  async delete(id: string): Promise<Role | null> {
    return this.roleModel.findByIdAndDelete(id).exec();
  }
}
