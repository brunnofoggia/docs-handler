import { Column, Entity, ObjectLiteral, OneToMany, PrimaryColumn } from 'typeorm';
import { set } from '../utils/entities';

import { TemplateConfigEntity } from './templateConfig.entity';

@Entity({ name: 'template' })
export class TemplateEntity {
    @PrimaryColumn({ name: 'uid' })
    uid: string;

    @Column(set({ name: 'default_config', type: 'jsonb', default: {} }))
    defaultConfig?: ObjectLiteral;

    @OneToMany(() => TemplateConfigEntity, (renderTemplateConfig) => renderTemplateConfig.template)
    templateConfigs?: TemplateConfigEntity[];
}
