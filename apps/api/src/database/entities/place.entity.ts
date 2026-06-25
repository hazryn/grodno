import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Miejsce — encja gazetteer (NIE free-text, p. spec §12). Hierarchia
 * kraj → region → miasto. W POC budujemy ją z napisów PLAC (split po przecinku),
 * bez współrzędnych (GeoNames dojdzie w fazie 3). `name` = pełny zapis, unikalny w drzewie.
 */
@Entity('places')
@Index(['treeId', 'name'], { unique: true })
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  @Column()
  name: string;

  /** Pierwszy człon — miejscowość (do kafelków/markerów). */
  @Column({ type: 'varchar', nullable: true })
  town: string | null;

  /** 'country' | 'region' | 'city' | null (poziom w hierarchii). */
  @Column({ type: 'varchar', nullable: true })
  type: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  gazetteerSource: string | null;

  @Column({ type: 'varchar', nullable: true })
  gazetteerId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
