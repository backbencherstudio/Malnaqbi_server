
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new category
  async create(createCategoryDto: CreateCategoryDto) {
    const { title, slug } = createCategoryDto;

    const category = await this.prisma.categories.create({
      data: {
        title,
        slug,
        status: 1,
      },
    });

    return category;
  }

  // Get all categories
  async findAll() {
    return this.prisma.categories.findMany();
  }

  // Get a single category by ID
  async findOne(id: string) {
    return this.prisma.categories.findUnique({
      where: {
        id,
      },
    });
  }

  // Update a category by ID
  async update(id: string, updateCategoryDto: CreateCategoryDto) {
    const { title, status } = updateCategoryDto;
    return this.prisma.categories.update({
      where: { id },
      data: {
        title,
        status,
      },
    });
  }

  // Delete a category by ID (soft delete)
  async remove(id: string) {
    return this.prisma.categories.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });
  }
}
