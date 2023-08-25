import { TemplateConfigEntity } from '../../entities/templateConfig.entity';
import { templateMultipleCsv, templateMultipleHtml, templateRecursiveHtml, templateSingleHtml } from './template';

export const projectUid = 'test';

const model: TemplateConfigEntity = {
    projectUid,
    templateUid: '',
    config: {},
};

let id = 1;

export const configSingleHtml: TemplateConfigEntity = {
    id: id++,
    projectUid,
    templateUid: templateSingleHtml.uid,
    config: {
        y: 3,
        z: 4,
    },
};

export const configMultipleHtml: TemplateConfigEntity = {
    id: id++,
    projectUid,
    templateUid: templateMultipleHtml.uid,
    config: {},
};

export const configMultipleCsv: TemplateConfigEntity = {
    id: id++,
    projectUid,
    templateUid: templateMultipleCsv.uid,
    config: {},
};

export const configRecursiveHtml: TemplateConfigEntity = {
    id: id++,
    projectUid,
    templateUid: templateRecursiveHtml.uid,
    config: {},
};

// used to insert rows into db
export const templateConfigList = [configSingleHtml, configMultipleHtml, configMultipleCsv, configRecursiveHtml];
