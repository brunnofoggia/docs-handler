import { DynamicDatabase } from './dynamicDatabase.service';

import { TemplateConfigEntity } from '../entities/templateConfig.entity';

export class TemplateConfigService extends DynamicDatabase<TemplateConfigEntity> {
    protected entity = TemplateConfigEntity;
}
