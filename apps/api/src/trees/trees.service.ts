import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Individual, Tree } from '../database/entities';

export interface TreeSummary {
  id: string;
  name: string;
  title: string | null;
  individualCount: number;
  /** Domyślna osoba startowa (najmniejszy xref). */
  focalId: string | null;
}

@Injectable()
export class TreesService {
  constructor(
    @InjectRepository(Tree) private readonly treeRepo: Repository<Tree>,
    @InjectRepository(Individual) private readonly indiRepo: Repository<Individual>,
  ) {}

  async list(): Promise<TreeSummary[]> {
    const trees = await this.treeRepo.find({ order: { createdAt: 'ASC' } });
    return Promise.all(trees.map((t) => this.summarize(t)));
  }

  async getByName(name: string): Promise<TreeSummary> {
    const tree = await this.treeRepo.findOne({ where: { name } });
    if (!tree) throw new NotFoundException(`Drzewo "${name}" nie istnieje`);
    return this.summarize(tree);
  }

  private async summarize(tree: Tree): Promise<TreeSummary> {
    const individualCount = await this.indiRepo.count({ where: { treeId: tree.id } });
    const focal = await this.indiRepo.findOne({
      where: { treeId: tree.id },
      order: { xref: 'ASC' },
    });
    return {
      id: tree.id,
      name: tree.name,
      title: tree.title,
      individualCount,
      focalId: focal?.id ?? null,
    };
  }
}
