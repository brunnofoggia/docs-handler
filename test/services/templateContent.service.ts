import { DynamicDatabase } from './dynamicDatabase.service';

import { TemplateContentEntity } from '../entities/templateContent.entity';

export class TemplateContentService extends DynamicDatabase<TemplateContentEntity> {
    protected entity = TemplateContentEntity;
}
