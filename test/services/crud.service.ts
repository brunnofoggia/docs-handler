import { HttpStatusCode } from 'axios';
import { filter, find, omit, result, size } from 'lodash';
import { IsNull } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { throwHttpException } from '../utils/errors';
import { IdInterface } from '../interfaces/id.interface';

export interface CrudServiceParamsInterface {
    find?: boolean;
    get?: boolean;
}

export class CrudService<ENTITY> {
    protected repository;
    protected idAttribute = 'id';
    protected _shouldApplyDeletedAt;
    protected _deletedAttribute = 'deletedAt';
    protected _updatedAttribute;

    // #region core methods (cannot be overriden)
    private async _checkIdTaken(id: number | string): Promise<boolean> {
        const item = await this._findById(id);
        if (!item) throwHttpException('', HttpStatusCode.NotFound);
        return true;
    }

    private async _checkIdNotTaken(id: number | string): Promise<boolean> {
        const item = await this._findById(id);
        if (item) throwHttpException('', HttpStatusCode.Found);
        return true;
    }

    private _findAll(options: any = {}): Promise<ENTITY[]> {
        const defaultOrder: any = {};
        defaultOrder[this.idAttribute] = 'ASC';

        /**
         * bug found when sending "order: {}" (empty object)
         * bug occurs when dealing with long pagination process with tons of data
         * scenario:
         * { skip: 500000, take: 50000, order: {} } (into a view, not a table)
         * solution:
         * always have an order by and a pk on select
         */
        const order = size(options.order) ? options.order : defaultOrder;

        options = {
            ...omit(options, 'order'),
            order,
        };

        return this.getRepository().find(options);
    }

    private _find(options: any = {}): Promise<ENTITY[]> {
        options.where = {
            ...options.where,
        };

        if (this.shouldApplyDeletedAt() && !options._ignoreDeleted) {
            options.where[this._deletedAttribute] = IsNull();
        }

        return this._findAll(omit(options, '_ignoreDeleted'));
    }

    private async _findById(id: number | string, options: any = {}): Promise<ENTITY> {
        const where: any = { ...options.where };
        where[this.idAttribute] = id;

        return (
            (
                await this.find({
                    ...options,
                    where,
                    take: 1,
                })
            ).shift() || null
        );
    }

    private async _create(_item: QueryDeepPartialEntity<ENTITY>, params: Partial<CrudServiceParamsInterface> = {}): Promise<IdInterface> {
        _item[this.idAttribute] && (await this.checkIdNotTaken(result(_item, this.idAttribute)));

        // to make beforeinsert work
        const item = this.getRepository().create({ ..._item });

        await this.getRepository().save(item);

        let _result: any = { id: result(item, this.idAttribute) };
        if (params.find) {
            _result = await this.findById(_result.id as string | number);
        } else if (params.get) {
            _result = item;
        }
        return _result;
    }

    private async _update(_item: QueryDeepPartialEntity<ENTITY>): Promise<IdInterface> {
        await this.checkIdTaken(result(_item, this.idAttribute));
        const item = this.updatedAt(_item);
        await this.getRepository().save(item);
        return { id: result(item, this.idAttribute) };
    }

    // insert or update a record
    private async _replace(_item: QueryDeepPartialEntity<ENTITY>): Promise<IdInterface> {
        const id = result(_item, this.idAttribute) as any;
        const existentItem = id ? await this.findById(id) : null;

        if (existentItem) {
            const item = this.updatedAt(_item);
            await this.getRepository().save(item);
            return { id: result(item, this.idAttribute) };
        }

        return (await this.create(_item)) as IdInterface;
    }

    // decides whether to soft delete or hard delete
    private async _remove(id: number | string): Promise<IdInterface> {
        return this.shouldApplyDeletedAt() ? this.hide(id) : this.delete(id);
    }

    // soft delete
    private async _hide(id: number | string): Promise<IdInterface> {
        if (!this.shouldApplyDeletedAt())
            throwHttpException(`couldnt find "${this._deletedAttribute}" field for soft deletion`, HttpStatusCode.NotImplemented);

        await this.checkIdTaken(id);

        let item: any = {};
        item[this.idAttribute] = id;
        item = this.deletedAt(item);
        item = this.updatedAt(item);

        await this.getRepository().save(item);
        return { id };
    }

    // hard delete
    private async _delete(id: number | string): Promise<IdInterface> {
        await this.checkIdTaken(id);
        await this.getRepository().delete(id);
        return { id };
    }
    // #endregion

    // #region public methods (can be overriden)
    async checkIdTaken(id: number | string): Promise<boolean> {
        return this._checkIdTaken(id);
    }

    async checkIdNotTaken(id: number | string): Promise<boolean> {
        return this._checkIdNotTaken(id);
    }

    find(options = {}): Promise<ENTITY[]> {
        return this._find(options);
    }

    findAll(options = {}): Promise<ENTITY[]> {
        return this._findAll(options);
    }

    async findById(id: number | string, options: any = {}): Promise<ENTITY> {
        return this._findById(id, options);
    }

    async create(_item: QueryDeepPartialEntity<ENTITY>, params: Partial<CrudServiceParamsInterface> = {}): Promise<IdInterface | ENTITY> {
        return this._create(_item, params);
    }

    async update(_item: QueryDeepPartialEntity<ENTITY>): Promise<IdInterface> {
        return this._update(_item);
    }

    async replace(_item: QueryDeepPartialEntity<ENTITY>): Promise<IdInterface> {
        return this._replace(_item);
    }

    async hide(id: number | string): Promise<IdInterface> {
        return this._hide(id);
    }

    async delete(id: number | string): Promise<IdInterface> {
        return this._delete(id);
    }

    async remove(id: number | string): Promise<IdInterface> {
        return this._remove(id);
    }
    // #endregion

    // #region helpers
    async createIfNotExists(
        _item: QueryDeepPartialEntity<ENTITY>,
        where: QueryDeepPartialEntity<ENTITY>,
        params: Partial<CrudServiceParamsInterface> = {},
    ): Promise<IdInterface | ENTITY> {
        let item: any = (await this.findAll({ where }))?.shift();
        if (!item) {
            item = await this.create({ ..._item }, params);
        }

        let _result: any = { id: result(item, this.idAttribute) };
        if (params.find || params.get) {
            _result = item;
        }
        return _result;
    }

    count(options: any = {}): Promise<number> {
        return this.getRepository().count(options);
    }

    async countQueryBuilder(queryBuilder) {
        return this.countSubQuery(queryBuilder.getQuery());
    }

    async countSubQuery(query, ...args) {
        const _countQuery = this.buildCountSubQuery(query);
        return this._countQueryExec(_countQuery, ...args);
    }

    async _countQueryExec(countQuery, ...args): Promise<number> {
        const rawData = (await this.getRepository().query(countQuery, args))?.shift() || {};
        return +(rawData?.count || 0);
    }

    buildCountSubQuery(query) {
        return `
            SELECT COUNT(1) AS "count" FROM (
                ${query}
            ) AS "result"
        `;
    }

    // #endregion

    // #region getters
    getIdAttribute() {
        return this.idAttribute;
    }

    getRepository() {
        return this.repository;
    }

    getEntity() {
        return this['entity'] || this.getRepository().target;
    }

    getDataSource() {
        return this.getRepository().manager.connection;
    }

    getMetadata() {
        return this.getDataSource().getMetadata(this.getEntity());
    }

    getConnectionType() {
        return this.getDataSource().options.type;
    }
    // #endregion

    // #region metadata
    findMetadata(fn) {
        const metadata = this.getMetadata();
        return find(metadata.columns, fn);
    }

    filterMetadata(fn) {
        const metadata = this.getMetadata();
        return filter(metadata, fn);
    }

    findMetadataByColumn(columnName) {
        return this.findMetadata((column) => column.propertyName === columnName);
    }
    // #endregion

    // #region hooks
    // updated at only works for postgres if implemented manually
    updatedAt(_item) {
        if (this.shouldApplyManualUpdatedAt()) {
            if (!this._updatedAttribute) {
                const column: any = this.findMetadata((column) => {
                    const onUpdate = result(column, 'onUpdate') + '';
                    return onUpdate.indexOf('CURRENT_TIMESTAMP') >= 0;
                });
                this._updatedAttribute = column?.propertyName;
            }
            if (this._updatedAttribute) _item[this._updatedAttribute] = new Date().toISOString();
        }

        return _item;
    }

    shouldApplyManualUpdatedAt() {
        return this.getConnectionType() === 'postgres';
    }

    deletedAt(_item) {
        if (this.shouldApplyDeletedAt()) _item[this._deletedAttribute] = new Date().toISOString();
        return _item;
    }

    shouldApplyDeletedAt() {
        if (typeof this._shouldApplyDeletedAt !== 'undefined') return this._shouldApplyDeletedAt;

        const column = this.findColumnDeletedAt();
        return (this._shouldApplyDeletedAt = !!column);
    }

    findColumnDeletedAt() {
        return this.findMetadataByColumn(this._deletedAttribute);
    }
    // #endregion
}
