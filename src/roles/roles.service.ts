import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './role.schema';
import { RedisService } from '../redis/redis.service';
import { CacheKeys, CacheTtlSeconds } from '../redis/cache-keys';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    private readonly redis: RedisService,
  ) {}

  async findAll(): Promise<RoleDocument[]> {
    const key = CacheKeys.rolesAll();
    const cached = await this.redis.getJson<Record<string, unknown>[]>(key);
    if (cached) {
      return cached.map((raw) => this.roleModel.hydrate(raw));
    }

    const docs = await this.roleModel.find().exec();
    await this.redis.setJson(
      key,
      docs.map((d) => d.toObject()),
      CacheTtlSeconds.roles,
    );
    return docs;
  }

  async findById(id: string): Promise<RoleDocument | null> {
    return this.roleModel.findById(id).exec();
  }

  async create(roleData: {
    name: string;
    icon: string;
    description: string;
  }): Promise<RoleDocument> {
    const role = new this.roleModel(roleData);
    const saved = await role.save();
    await this.redis.del(CacheKeys.rolesAll());
    return saved;
  }

  async update(
    id: string,
    roleData: {
      name?: string;
      icon?: string;
      description?: string;
    },
  ): Promise<RoleDocument | null> {
    const updated = await this.roleModel
      .findByIdAndUpdate(id, roleData, { new: true })
      .exec();
    await this.redis.del(CacheKeys.rolesAll());
    return updated;
  }

  async delete(id: string): Promise<RoleDocument | null> {
    const deleted = await this.roleModel.findByIdAndDelete(id).exec();
    await this.redis.del(CacheKeys.rolesAll());
    return deleted;
  }
}
