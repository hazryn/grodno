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

  /**
   * Top N nazwisk w drzewie (agregat publiczny — bez danych osobowych, tylko nazwisko + liczba).
   * Każda osoba liczona raz na dane nazwisko (po wszystkich wariantach imion); warianty pisowni
   * scalane po lower(), do wyświetlenia bierzemy najczęstszą formę.
   */
  async topSurnames(
    treeName: string,
    limit = 20,
  ): Promise<Array<{ surname: string; count: number }>> {
    const tree = await this.treeRepo.findOne({ where: { name: treeName } });
    if (!tree) return [];
    const rows: Array<{ surname: string; count: string | number }> = await this.indiRepo.query(
      `SELECT mode() WITHIN GROUP (ORDER BY disp) AS surname, count(*)::int AS count
       FROM (
         SELECT i.id,
                lower(trim(n->>'surname')) AS skey,
                (array_agg(trim(n->>'surname')))[1] AS disp
         FROM individuals i
         CROSS JOIN LATERAL jsonb_array_elements(i.names) AS n
         WHERE i."deletedAt" IS NULL
           AND i."treeId" = $1
           AND coalesce(trim(n->>'surname'), '') <> ''
           -- min. 3 LITERY (po odrzuceniu kropek/spacji) — wycina Sr., Jr., M., M, inicjały
           AND length(regexp_replace(trim(n->>'surname'), '[^[:alpha:]]', '', 'g')) >= 3
           -- odrzuć cyfry rzymskie (III, VII…) wpadające do pola surname
           AND lower(regexp_replace(trim(n->>'surname'), '[^[:alpha:]]', '', 'g')) NOT IN
               ('iii', 'vii', 'viii', 'xii', 'xiii', 'xiv', 'xvii', 'xviii')
         GROUP BY i.id, lower(trim(n->>'surname'))
       ) per_person
       GROUP BY skey
       ORDER BY count DESC, surname ASC
       LIMIT $2`,
      [tree.id, limit],
    );
    return rows.map((r) => ({ surname: r.surname, count: Number(r.count) }));
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
