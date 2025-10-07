import { DataSource } from 'typeorm';
import { DeepPartial } from '../common/types/deepPartial';

import { DatabaseConnect } from '@test/utils/connect';
import { projectUid } from '@test/mock/entities/templateConfig';
import { TemplateService } from '@test/services/template.service';
import { TemplateConfigService } from '@test/services/templateConfig.service';
import { TemplateContentService } from '@test/services/templateContent.service';
import { templateRecursiveHtml } from '@test/mock/entities/template';
import { getServices } from '@test/utils/prepareData';
import { TemplateDomain } from '../domain/Template';
import { TemplateConfigInterface, TemplateContentInterface } from 'interfaces/entities';
import { HtmlGenerator } from './html';
import { TextStreamUtil } from 'cloud-solutions/dist/local/storage/textStreamUtil';
import { userFetchFn, userHeader } from '@test/mock/data/user';
import { findCook } from 'domain/Template.test';
import { DatabaseOptions } from 'interfaces/domain';

describe('Domain > DocGenDomain', () => {
    let conn: DataSource;
    let templateService: TemplateService;
    let templateConfigService: TemplateConfigService;
    let templateContentService: TemplateContentService;
    let templateConfig: TemplateConfigInterface;
    let contents: TemplateContentInterface[];
    let templates: HtmlGenerator[];
    const configRelations = {
        template: 'template',
        contents: 'templateContents',
    };
    const databaseConfig: DeepPartial<DatabaseOptions> = {
        relationsKeys: configRelations,
        contentId: 'id',
        contentParentId: 'templateContentId',
        contentName: 'name',
    };

    let templateDomain: TemplateDomain;
    const defaultTemplateWhere = {
        projectUid,
        templateUid: templateRecursiveHtml.uid,
    };

    beforeAll(async () => {
        conn = await DatabaseConnect();
        const services = getServices(conn);
        templateService = services.templateService;
        templateConfigService = services.templateConfigService;
        templateContentService = services.templateContentService;

        templateConfig = await findCook(templateConfigService, defaultTemplateWhere)();
    });

    beforeEach(async () => {
        templateDomain = new TemplateDomain({
            templateConfig,
            database: databaseConfig,
        });
        contents = templateDomain.normalizeTemplateContents(templateConfig.templateContents);
        templates = templateDomain.buildTemplatesTree(templateDomain.templatesFactory(contents, {})) as HtmlGenerator[];
    });

    describe('generate all', () => {
        it('generating multiple recursive templates', async () => {
            expect.assertions(1);

            const stream = new TextStreamUtil();

            const input: any = {};
            input.title = 'ASYNC';

            input.header = userHeader;
            input.rows = userFetchFn();

            await templateDomain.generateAll(templates, input, stream);
            expect(stream.getContent().length).toBeGreaterThan(0);
        });
    });
});
