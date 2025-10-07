import { DataSource } from 'typeorm';
import { DeepPartial } from '../common/types/deepPartial';
import { each, size, isArray, defaultsDeep } from 'lodash';
import { TextStreamUtil } from 'cloud-solutions/dist/local/storage/textStreamUtil';

import { DatabaseConnect } from '@test/utils/connect';
import { projectUid, templateConfigList } from '@test/mock/entities/templateConfig';
import { TemplateService } from '@test/services/template.service';
import { TemplateConfigService } from '@test/services/templateConfig.service';
import { TemplateContentService } from '@test/services/templateContent.service';
import {
    templateList,
    templateMultipleCsv,
    templateMultipleHtml,
    templateRecursiveHtml,
    templateSingleHtml,
} from '@test/mock/entities/template';
import { getServices } from '@test/utils/prepareData';
import { templateContentList } from '@test/mock/entities/templateContent';
import { getError } from 'utils';
import { DocGeneratorErrorType } from '../types/error';
import { TemplateDomain } from './Template';
import { TemplateGenerator } from 'templates/template.abstract';
import { findCook, getNormalizedContents, getTemplateGenerators, getTemplateGeneratorsFromContents } from './Template.test';
import { userFetchFn, userHeader } from '@test/mock/data/user';
import { DatabaseOptions } from 'interfaces/domain';
import { TemplateConfigInterface } from 'interfaces/entities';

describe('Domain > DocGenDomain', () => {
    let conn: DataSource;
    let templateService: TemplateService;
    let templateConfigService: TemplateConfigService;
    let templateContentService: TemplateContentService;
    let templateConfig: TemplateConfigInterface;

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
    };

    beforeAll(async () => {
        conn = await DatabaseConnect();
        const services = getServices(conn);
        templateService = services.templateService;
        templateConfigService = services.templateConfigService;
        templateContentService = services.templateContentService;

        const templateWhere = { ...defaultTemplateWhere };
        templateConfig = await findCook(templateConfigService, defaultTemplateWhere, templateSingleHtml.uid)();
    });

    beforeEach(() => {
        templateDomain = new TemplateDomain({
            templateConfig,
            database: databaseConfig,
        });
    });

    describe('variables and data ready', () => {
        it('database connected', () => {
            expect.assertions(1);

            expect(conn).toBeDefined();
        });

        it('template service is defined', () => {
            expect.assertions(1);

            expect(templateService).toBeDefined();
        });

        it('data is seeded', async () => {
            expect.assertions(3);
            let results = [];
            results = await templateService.find();
            expect(results.length).toEqual(templateList.length);
            results = await templateConfigService.find();
            expect(results.length).toEqual(templateConfigList.length);
            results = await templateContentService.find();
            expect(results.length).toEqual(templateContentList.length);
        });

        it('domain defined', () => {
            expect.assertions(1);

            expect(templateDomain).toBeDefined();
        });
    });

    describe('finding config and content data from tables', () => {
        it('template config not found', async () => {
            expect.assertions(1);

            templateDomain = new TemplateDomain({
                database: databaseConfig,
            });

            await expect(async () => templateDomain.checkTemplateConfig()).rejects.toThrow(getError(DocGeneratorErrorType.NO_CONFIG));
        });
    });

    describe('preparing data', () => {
        it('normalize contents', async () => {
            expect.assertions(1);

            const normalizedContents = await getNormalizedContents({
                templateDomain,
                templateConfigService,
                defaultTemplateWhere,
                templateUid: templateRecursiveHtml.uid,
            });

            let test = true;
            each(normalizedContents, (content) => {
                if (!isArray(content[configRelations.contents])) test = false;
            });
            expect(test).toBeTruthy();
        });

        it('key contents by id', async () => {
            expect.assertions(1);

            const _templateConfig = await findCook(templateConfigService, defaultTemplateWhere, templateRecursiveHtml.uid)();
            templateDomain.setOptions({ templateConfig: _templateConfig });
            // const templateWhere = { ...defaultTemplateWhere, templateUid: templateRecursiveHtml.uid };
            // templateDomain.setOptions({ templateWhere });

            const contents = templateDomain.keyByIdTemplateContents(_templateConfig.templateContents);

            let test = true;
            each(contents, (content, index) => {
                if (+index !== content[templateContentService.getIdAttribute()]) test = false;
            });
            expect(test).toBeTruthy();
        });
    });

    describe('factory', () => {
        it('building one template based on type', async () => {
            expect.assertions(2);

            const normalizedContents = await getNormalizedContents({
                templateDomain,
                templateConfigService,
                defaultTemplateWhere,
                templateUid: templateRecursiveHtml.uid,
            });
            const template = templateDomain.templateFactory(normalizedContents[0], {});

            expect(template instanceof TemplateGenerator).toBeTruthy();
            expect(template.getType() === template.getBaseType()).toBeTruthy();
        });

        it('building templates', async () => {
            expect.assertions(1);

            const templates = await getTemplateGenerators({
                templateDomain,
                templateConfigService,
                defaultTemplateWhere,
                templateUid: templateRecursiveHtml.uid,
            });

            let test = true;
            each(templates, (template) => {
                if (!(template instanceof TemplateGenerator)) test = false;
            });
            expect(test).toBeTruthy();
        });
    });

    describe('hierarchy', () => {
        it('put children inside parents, clear root from children', async () => {
            expect.assertions(2);

            const normalizedContents = await getNormalizedContents({
                templateDomain,
                templateConfigService,
                defaultTemplateWhere,
                templateUid: templateRecursiveHtml.uid,
            });
            const totalTemplates = normalizedContents.length;

            const templates = getTemplateGeneratorsFromContents({ templateDomain, normalizedContents });
            const organizedTemplates = templateDomain.buildTemplatesTree(templates);

            let onlyParentsInsideRoot = true;
            let countTemplates = 0;
            each(organizedTemplates, (template) => {
                if (template.getParentId()) {
                    onlyParentsInsideRoot = false;
                }
                countTemplates += 1 + template.getChildrenLength();
            });

            expect(onlyParentsInsideRoot).toBeTruthy();
            expect(totalTemplates).toEqual(countTemplates);
        });
    });

    describe('validate all', () => {
        it('validating multiple inline templates', async () => {
            expect.assertions(1);

            const templates = await getTemplateGenerators({
                templateDomain,
                templateConfigService,
                defaultTemplateWhere,
                templateUid: templateMultipleHtml.uid,
            });

            await expect(templateDomain.validateAll(templates)).resolves.toBeTruthy();
        });

        it('validating multiple recursive templates', async () => {
            expect.assertions(1);

            const templates = templateDomain.buildTemplatesTree(
                await getTemplateGenerators({
                    templateDomain,
                    templateConfigService,
                    defaultTemplateWhere,
                    templateUid: templateRecursiveHtml.uid,
                }),
            );

            await expect(templateDomain.validateAll(templates)).resolves.toBeTruthy();
        });
    });

    describe('generate all', () => {
        it('generating multiple inline html templates', async () => {
            expect.assertions(3);

            const templates = await getTemplateGenerators({
                templateDomain,
                templateConfigService,
                defaultTemplateWhere,
                templateUid: templateMultipleHtml.uid,
            });

            const stream = new TextStreamUtil();
            await expect(templateDomain.generateAll(templates, {}, stream)).resolves.toBeUndefined();
            expect(stream.getContent().length).toBeGreaterThan(0);
            expect(stream.getContent().indexOf('<body>')).toBeGreaterThan(0);
        });

        it('generating multiple recursive html templates', async () => {
            expect.assertions(3);
            const templates = templateDomain.buildTemplatesTree(
                await getTemplateGenerators({
                    templateDomain,
                    templateConfigService,
                    defaultTemplateWhere,
                    templateUid: templateRecursiveHtml.uid,
                }),
            );

            const input: any = {};
            input.header = userHeader;
            input.rows = userFetchFn();

            const stream = new TextStreamUtil();
            await expect(templateDomain.generateAll(templates, input, stream)).resolves.toBeUndefined();
            expect(stream.getContent().length).toBeGreaterThan(0);
            expect(stream.getContent().indexOf('<body>')).toBeGreaterThan(0);
        });

        it('generating multiple recursive csv templates', async () => {
            expect.assertions(2);
            const templates = templateDomain.buildTemplatesTree(
                await getTemplateGenerators({
                    templateDomain,
                    templateConfigService,
                    defaultTemplateWhere,
                    templateUid: templateMultipleCsv.uid,
                }),
            );

            const input: any = { seeder: {}, calculator: {} };
            input.header = userHeader;
            const fetch = userFetchFn();
            input.seeder.body = async (input, renderer) => {
                let feed;
                while ((feed = await fetch())) {
                    await renderer(feed);
                }
            };
            input.calculator.body = async (input) => {
                if (!input.output.savings) input.output.savings = 0;
                input.output.savings += input.feed.savings;
            };

            const stream = new TextStreamUtil();
            await expect(templateDomain.generateAll(templates, input, stream)).resolves.toBeUndefined();
            const lines = stream.getContent().split(/\r?\n/);

            expect(lines.length).toBeGreaterThan(3);
            // expect(stream.getContent().indexOf('<body>')).toBeGreaterThan(0);
        });
    });
});
