import { DataSource } from 'typeorm';
import { each, size, isArray } from 'lodash';
import { TextStreamUtil } from 'cloud-solutions/dist/local/storage/textStreamUtil';

import { DatabaseConnect } from '@test/utils/connect';
import { projectUid, templateConfigList } from '@test/mock/entities/templateConfig';
import { TemplateService } from '@test/services/template.service';
import { TemplateConfigService } from '@test/services/templateConfig.service';
import { TemplateContentService } from '@test/services/templateContent.service';
import { templateList, templateMultipleCsv, templateMultipleHtml, templateRecursiveHtml, templateSingleHtml } from '@test/mock/entities/template';
import { getServices } from '@test/utils/prepareData';
import { templateContentList } from '@test/mock/entities/templateContent';
import { getError } from 'utils';
import { DocGeneratorErrorType } from '../types/error';
import { TemplateDomain } from './Template';
import { TemplateGenerator } from 'templates/template.abstract';
import { getNormalizedContents, getTemplateGenerators, getTemplateGeneratorsFromContents } from './Template.test';
import { userFetchFn, userHeader } from '@test/mock/data/user';

describe('Domain > DocGenDomain', () => {
    let conn: DataSource;
    let templateService: TemplateService;
    let templateConfigService: TemplateConfigService;
    let templateContentService: TemplateContentService;
    const configRelations = {
        template: 'template',
        contents: 'templateContents',
    };
    const databaseConfig = {
        configRelations,
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

        templateDomain = new TemplateDomain({
            templateService,
            templateConfigService,
            templateContentService,
            database: databaseConfig,
        });
    });

    beforeEach(() => {
        const templateWhere = { ...defaultTemplateWhere };
        templateDomain.setOptions({ templateWhere });
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
        it('no conditions set for finding template', async () => {
            expect.assertions(1);

            const templateWhere = {};
            templateDomain.setOptions({ templateWhere });

            await expect(templateDomain.findTemplateConfig()).rejects.toThrowError(getError(DocGeneratorErrorType.NO_WHERE));
        });

        it('template config not found', async () => {
            expect.assertions(1);

            const templateWhere = { ...defaultTemplateWhere, templateUid: 'xxx' };
            templateDomain.setOptions({ templateWhere });

            await expect(templateDomain.findTemplateConfig()).rejects.toThrowError(getError(DocGeneratorErrorType.NO_CONFIG));
        });

        it('find one template config', async () => {
            expect.assertions(1);

            const templateWhere = { ...defaultTemplateWhere, templateUid: templateSingleHtml.uid };
            templateDomain.setOptions({ templateWhere });
            const result = await templateDomain.findTemplateConfig();

            expect(size(result)).toBeGreaterThanOrEqual(1);
        });
    });

    describe('preparing data', () => {
        it('normalize contents', async () => {
            expect.assertions(1);

            const normalizedContents = await getNormalizedContents({
                templateDomain,
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

            const templateWhere = { ...defaultTemplateWhere, templateUid: templateRecursiveHtml.uid };
            templateDomain.setOptions({ templateWhere });
            const templateConfig = await templateDomain.findTemplateConfig();
            const contents = templateDomain.keyByIdTemplateContents(templateConfig.templateContents);

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
                defaultTemplateWhere,
                templateUid: templateRecursiveHtml.uid,
            });
            const totalTemplates = normalizedContents.length;

            const templates = getTemplateGeneratorsFromContents({ templateDomain, normalizedContents });
            const organizedTemplates = templateDomain.buildChainOfTemplates(templates);

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
                defaultTemplateWhere,
                templateUid: templateMultipleHtml.uid,
            });

            await expect(templateDomain.validateAll(templates)).resolves.toBeTruthy();
        });

        it('validating multiple recursive templates', async () => {
            expect.assertions(1);

            const templates = templateDomain.buildChainOfTemplates(
                await getTemplateGenerators({
                    templateDomain,
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
            const templates = templateDomain.buildChainOfTemplates(
                await getTemplateGenerators({
                    templateDomain,
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
            const templates = templateDomain.buildChainOfTemplates(
                await getTemplateGenerators({
                    templateDomain,
                    defaultTemplateWhere,
                    templateUid: templateMultipleCsv.uid,
                }),
            );

            const input: any = { seeder: {}, calculator: {} };
            input.header = userHeader;
            input.seeder.body = userFetchFn();
            input.calculator.body = async (input) => {
                if (!input.output.savings) input.output.savings = 0;
                input.output.savings += input.feed.savings;
            };

            const stream = new TextStreamUtil();
            await expect(templateDomain.generateAll(templates, input, stream)).resolves.toBeUndefined();
            console.log('csv', stream.getContent());

            expect(stream.getContent().length).toBeGreaterThan(0);
            // expect(stream.getContent().indexOf('<body>')).toBeGreaterThan(0);
        });
    });
});
