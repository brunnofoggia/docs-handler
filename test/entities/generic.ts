import { PrimaryGeneratedColumn } from 'typeorm';
import { TimestampEntity } from './timestamp';

export class GenericEntity extends TimestampEntity {
    @PrimaryGeneratedColumn()
    id?: number;
}

