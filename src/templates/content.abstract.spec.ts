import { DataSource } from 'typeorm';
import { DeepPartial } from '../common/types/deepPartial';

import { DatabaseConnect } from '@test/utils/connect';
import { projectUid } from '@test/mock/entities/templateConfig';
import { TemplateService } from '@test/services/template.service';
import { TemplateConfigService } from '@test/services/templateConfig.service';
import { TemplateContentService } from '@test/services/templateContent.service';
import { templateSingleHtml } from '@test/mock/entities/template';
import { getServices } from '@test/utils/prepareData';
import { TemplateDomain } from '../domain/Template';
import { TemplateGenerator } from 'templates/template.abstract';
import { TemplateConfigInterface, TemplateContentInterface } from 'interfaces/entities';
import { HtmlGenerator } from './html';
import { userFetchFn } from '@test/mock/data/user';
import { findCook } from 'domain/Template.test';
import { DatabaseOptions } from 'interfaces/domain';

describe('Domain > DocGenDomain', () => {
    let conn: DataSource;
    let templateService: TemplateService;
    let templateConfigService: TemplateConfigService;
    let templateContentService: TemplateContentService;
    let templateConfig: TemplateConfigInterface;
    let contents: TemplateContentInterface[];
    let template: HtmlGenerator;
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

    let domain: TemplateDomain;
    const defaultTemplateWhere = {
        projectUid,
        templateUid: templateSingleHtml.uid,
    };

    beforeAll(async () => {
        conn = await DatabaseConnect();
        const services = getServices(conn);
        templateService = services.templateService;
        templateConfigService = services.templateConfigService;
        templateContentService = services.templateContentService;

        const templateWhere = { ...defaultTemplateWhere };
        templateConfig = await findCook(templateConfigService, defaultTemplateWhere)();
    });

    beforeEach(async () => {
        domain = new TemplateDomain({
            templateConfig,
            database: databaseConfig,
        });
        contents = domain.normalizeTemplateContents([templateConfig.templateContents[0]]);
        template = domain.templateFactory(contents[0], {}) as HtmlGenerator;
    });

    describe('variables and data ready', () => {
        it('domain defined', () => {
            expect(domain).toBeDefined();
        });
    });

    describe('validate', () => {
        it('validating html with unexpected token throws an error', async () => {
            expect.assertions(2);
            const html = `<h1>HTML</h1>
                <div><%>=title%>
            `;

            expect(template instanceof TemplateGenerator).toBeTruthy();
            await expect(template._validate(html)).rejects.toThrow();
        });

        it('validating valid html from template', async () => {
            expect.assertions(2);

            expect(template instanceof TemplateGenerator).toBeTruthy();
            await expect(template.validate()).resolves.toBeUndefined();
        });
    });

    describe('render', () => {
        it('rendering html from template', async () => {
            expect.assertions(1);

            const text = await template.render({ data: { title: 'testing' } });
            expect(text.length).toBeGreaterThan(0);
        });

        it('rendering html with missing property', async () => {
            expect.assertions(1);

            await expect(template.render()).rejects.toThrow();
        });

        it('rendering html with async function into data', async () => {
            expect.assertions(1);

            const html = `
                <h1><%= data.title %></h1>
                <% let user; %>
                <% while(user = await data.rows()) { %>
                    <ul>
                        <li><%=user.id%></li>
                        <li><%=user.name%></li>
                        <li><%=user.email%></li>
                        <li><%=user.birth%></li>
                    </ul>
                <% } %>
                .
            `;
            const _template = await template._validate(html, { async: true });
            const input: any = {};
            input.title = 'ASYNC';
            input.rows = userFetchFn();

            const output = await template._render(_template, { data: input });

            expect(output.length).toBeGreaterThan(0);
        });
    });
});
