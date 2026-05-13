import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async findAll() {
    const roles = await this.rolesService.findAll();
    return roles.map((role) => ({
      id: role._id,
      name: role.name,
      icon: role.icon,
      description: role.description,
    }));
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const role = await this.rolesService.findById(id);
    if (!role) {
      return { message: 'Role not found' };
    }
    return {
      id: role._id,
      name: role.name,
      icon: role.icon,
      description: role.description,
    };
  }
}
