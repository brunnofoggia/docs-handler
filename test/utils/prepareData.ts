import { IsNull, Not } from 'typeorm';
import { templateList } from '../mock/entities/template';
import { templateConfigList } from '../mock/entities/templateConfig';
import { templateContentList } from '../mock/entities/templateContent';
import { TemplateService } from '../services/template.service';
import { TemplateConfigService } from '../services/templateConfig.service';
import { TemplateContentService } from '../services/templateContent.service';

let services: {
    templateService: TemplateService;
    templateConfigService: TemplateConfigService;
    templateContentService: TemplateContentService;
};

export const getServices = function (conn) {
    if (!services)
        services = {
            templateService: new TemplateService(conn),
            templateConfigService: new TemplateConfigService(conn),
            templateContentService: new TemplateContentService(conn),
        };
    return services;
};

export async function seed(conn): Promise<void> {
    const { templateService, templateConfigService, templateContentService } = getServices(conn);

    await clear(conn);

    for (const item of [
        [templateService, templateList],
        [templateConfigService, templateConfigList],
        [templateContentService, templateContentList],
    ]) {
        const [service, list] = item;
        await insertRows(list, service);
    }
}

export async function clear(conn): Promise<void> {
    const { templateService, templateConfigService, templateContentService } = getServices(conn);
    for (const service of [templateContentService, templateConfigService, templateService]) {
        const clausule = {} as any;
        clausule[service.getIdAttribute()] = Not(IsNull());

        await service.getRepository().delete(clausule);
        if (service.getIdAttribute() === 'id')
            await service
                .getDataSource()
                .createQueryRunner()
                .query(`ALTER SEQUENCE ${service.getMetadata().tableName}_id_seq RESTART WITH 1;`);

        // console.log(`reseted "${service.getEntity().name}"`);
    }
}

async function insertRows(rows, service) {
    for (const row of rows) {
        const { id } = await service.create(row);
        // if (service.getIdAttribute() === 'id')
        row[service.getIdAttribute()] = id;
    }
    // console.log(`inserted ${rows.length} rows into "${service.getEntity().name}"`);
}
