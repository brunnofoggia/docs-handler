import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { set } from '../utils/entities';
import { GenericEntity } from '../entities/generic';

import { TemplateEntity } from './template.entity';
import { TemplateContentEntity } from './templateContent.entity';

@Entity({ name: 'template_config' })
export class TemplateConfigEntity extends GenericEntity {
    @Column({ name: 'project_uid' })
    projectUid: string;

    @Column(set({ type: 'jsonb', default: {} }))
    config?: any;

    @Column({ name: 'template_uid' })
    templateUid: string;

    @ManyToOne(() => TemplateEntity, (renderTemplate) => renderTemplate.templateConfigs)
    @JoinColumn({ name: 'template_uid' })
    template?: TemplateEntity;

    @OneToMany(() => TemplateContentEntity, (templateContent) => templateContent.templateConfig)
    templateContents?: TemplateContentEntity[];
}
