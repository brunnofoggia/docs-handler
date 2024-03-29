import debug_ from 'debug';
// const log = debug_('app:docs:KPdfGenerator');
const debug = debug_('debug:docs:KPdfGenerator');
// const debug = debug_('app:docs:KPdfGenerator');

import { isArray, random } from 'lodash';
import { createWriteStream } from 'fs';

import { OutputGenerator } from './output.abstract';
import { OutputType } from '../types/output';
import { OutputGenerateParams } from '../interfaces/domain';

// const defaultConfig: Partial<any> = {};

export class KPdfGenerator extends OutputGenerator {
    protected baseType = OutputType.KPDF;
    protected readonly needStream = false;
    protected readonly contentAsStream = true;

    async prepare(_params) {
        await super.prepare(_params);

        const emptyFile = _params.path.replace('output.pdf', '.empty');
        // random path implemented to solve problem when generating same file many times
        const filename = [new Date().getTime(), random(1000, 9999)].join('-') + '.pdf';
        _params.path = _params.path.replace('output.pdf', filename);

        // create dir tree before conversion
        const emptyFilePath = this.buildPathForFs(emptyFile, _params.fileSystem);
        await _params.fileSystem.sendContent(emptyFilePath, '');
        debug('creating empty file is ok');

        return _params;
    }

    async generate(_params: OutputGenerateParams) {
        const params = await this.prepare(_params);
        return this.conversion(params);
    }

    async conversion(params) {
        const { instance: pdf, stream } = await this.getLibInstance(params);
        debug('pdf instance is ok');

        debug('building from content');
        await this.buildFromContent(params.content, pdf, params);
        debug('building from content is ok');

        debug('saving pdf');
        await this.savePdf(pdf, params, stream);
        debug('saving pdf is ok');

        await this.closeStream(params.content.input);

        return { path: params.path };
    }

    closeStream(stream) {
        return new Promise((resolve) => {
            if (!stream.close || stream.closed) resolve({});
            stream.close();
            stream.on('close', () => {
                resolve({});
            });
        });
    }

    buildInstanceParams(config) {
        const instanceParams = !config.libInstanceParams
            ? []
            : isArray(config.libInstanceParams)
            ? config.libInstanceParams
            : [config.libInstanceParams];

        return instanceParams;
    }

    async getLibInstance(params) {
        // useful for switching between pdfkit and pdfkit-table
        const libName = params.config.libName || 'pdfkit';
        const KPDF = await this.dynamicImport(libName, params.config);

        const instanceParams = this.buildInstanceParams(params.config);
        const instance = new KPDF(...instanceParams);

        const stream = instance.pipe(createWriteStream(params.path));

        return { instance, stream };
    }

    async buildFromContent(content, pdf, params) {
        let c = 0;
        for await (const line of content) {
            await this.buildLine(line, pdf, params);
            c++;
        }

        if (!c) {
            await this.removeFile(params.path);
            throw new Error('read stream failed');
        } else debug('pdf built with', c, 'lines');
    }

    async buildLine(line, pdf, params) {
        const { method, args } = this.buildLineOptions(line);
        if (!method) return;
        if (!pdf[method]) {
            throw new Error(['template error at method;', 'method name', method, 'line:', line].join(' '));
        }

        debug('line length', line.length, 'method', method, 'args.length', args.length);
        await pdf[method](...(args || []));
    }

    buildLineOptions(line) {
        const splitter = '###';
        const [method, args_] = line.trim().split(splitter);
        if (!method) return {};

        return { method, args: this.buildLineArgs(args_, line) };
    }

    buildLineArgs(args_, line) {
        args_ = (args_ || '').trim();
        let args = args_ || '[]';
        if (!args.startsWith('[')) args = ['[', args].join('');
        if (!args.endsWith(']')) args = [args, ']'].join('');

        let json = [];
        try {
            json = JSON.parse(args);
        } catch (err) {
            debug('template error at arguments;', 'line:', line);
            debug('arguments string', args);
            debug('problem:', err.message);

            throw err;
        }
        return json;
    }

    savePdf(pdf, params, stream = null) {
        return new Promise((resolve) => {
            this._savePdf(pdf);
            stream.on('close', () => {
                resolve(true);
            });
        });
    }

    _savePdf(pdf): any {
        return pdf.end();
    }
}

export default KPdfGenerator;
