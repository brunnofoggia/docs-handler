import _debug from 'debug';
const debug = _debug('app:db:DynamicDatabase');

import { defaultsDeep, keys, omit } from 'lodash';
import { QueryRunner, Repository } from 'typeorm';
import { CrudService } from './crud.service';
// import _ from 'lodash';

export interface DatasourceOptions {
    database: string;
    databaseDir: string;
    synchronize: boolean;
    secretPath: string;
    [key: string]: any;
}

export interface DynamicDatasourceOptions extends DatasourceOptions {
    poolId: string;
    alias: string;
}

export class DynamicDatabase<ENTITY> extends CrudService<ENTITY> {
    protected static DatabaseConnect;
    private static dataSources: any = {};

    protected dataSource: any;
    protected repository: Repository<any>;

    protected poolId = 'default';
    protected databaseAlias = 'default';
    protected entity;

    constructor(poolIdOrDataSource = null) {
        super();
        this.setPoolOrDataSource(poolIdOrDataSource);
    }

    static setDatabaseConnect(DatabaseConnect) {
        DynamicDatabase.DatabaseConnect = DatabaseConnect;
    }

    static async setDataSource(options: Partial<DynamicDatasourceOptions> = {}) {
        const defaultOptions = { poolId: 'default', alias: '', database: '', databaseDir: '', synchronize: false, secretPath: undefined };
        const _options = defaultsDeep({}, options, defaultOptions);
        const _alias = _options.alias || _options.database;
        const datasourcePath = this.defineDatasourcePath(_alias, _options.poolId);
        if (!DynamicDatabase.getDataSource(_alias, _options.poolId)) {
            DynamicDatabase.dataSources[datasourcePath] = await DynamicDatabase.DatabaseConnect(omit(_options, 'poolId', 'alias'));
            debug(
                'connected to database',
                `"${DynamicDatabase.dataSources[datasourcePath]?.options?.database || '?'}"`,
                'with poolId',
                datasourcePath,
            );
        }
        return DynamicDatabase.dataSources[datasourcePath];
    }

    static checkDatasource(datasource) {
        return datasource && datasource.isInitialized;
    }

    static getDataSource(alias, poolId = 'default') {
        const datasourcePath = DynamicDatabase.defineDatasourcePath(alias, poolId);
        const datasource = DynamicDatabase.dataSources[datasourcePath];
        if (!DynamicDatabase.checkDatasource(datasource)) {
            DynamicDatabase.clearConnection(datasourcePath);
            return undefined;
        }
        return datasource;
    }

    static defineDatasourcePath(alias, poolId = 'default') {
        return [poolId, alias].join(':');
    }

    static listConnections() {
        return keys(DynamicDatabase.dataSources);
    }

    static async closeConnections(poolId = 'default') {
        for (const datasourcePath in DynamicDatabase.dataSources) {
            if (poolId && !datasourcePath.startsWith(poolId)) continue;

            await DynamicDatabase._closeConnection(datasourcePath);
        }
    }

    static async closeConnection(alias, poolId = 'default') {
        const datasourcePath = DynamicDatabase.defineDatasourcePath(alias, poolId);
        await DynamicDatabase._closeConnection(datasourcePath);
    }

    static async clearConnection(datasourcePath) {
        delete DynamicDatabase.dataSources[datasourcePath];
    }

    static async disconnect(datasource) {
        await datasource?.destroy();
    }

    static async _closeConnection(datasourcePath) {
        const datasource = DynamicDatabase.dataSources[datasourcePath];

        if (DynamicDatabase.checkDatasource(datasource)) {
            debug('closed connection', `"${datasource?.options?.database || '?'}"`, 'with poolId', datasourcePath);
            await DynamicDatabase.disconnect(datasource);
        }

        DynamicDatabase.clearConnection(datasourcePath);
        // DynamicDatabase.dataSources = omit(DynamicDatabase.dataSources, datasourcePath);
    }

    setPoolOrDataSource(value) {
        if (typeof value === 'string') this.poolId = value;
        else if (value) this.dataSource = value;
    }

    async initialize() {
        return this;
    }

    getDataSource() {
        return this.dataSource || this.setDataSource();
    }

    setDataSource(datasource = null): any {
        if (!this.dataSource) {
            if (datasource) {
                this.dataSource = datasource;
            } else if (this.databaseAlias && this.poolId) {
                this.dataSource = DynamicDatabase.getDataSource(this.databaseAlias, this.poolId);
            }
        }
        return this.dataSource;
    }

    getRepository() {
        const repository = this.repository || this.setRepository();
        return repository;
    }

    setRepository() {
        if (!this.repository && this.entity && this.poolId) {
            const datasource = this.getDataSource();
            if (!datasource) throw new Error(`connection not found. alias: ${this.databaseAlias} , poolId: ${this.poolId}`);
            this.repository = datasource.getRepository(this.entity);
        }
        return this.repository;
    }

    async checkIfTableExists() {
        try {
            const tableName = this.getDataSource().getMetadata(this.entity).tableName;
            const hasTable = await this.getDataSource().query(
                `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`,
            );
            debug(`Table ${tableName} exists: ${hasTable[0].exists}`);
            return true;
        } catch (error) {
            debug(error);
            return false;
        }
    }

    async insertBulkData(data: Array<any>, queryRunner: QueryRunner = null, options: any = {}) {
        if (data.length) {
            const queryBuilder = this.getRepository().createQueryBuilder('', queryRunner).insert().into(this.entity).values(data);
            if (options?.returning) queryBuilder.returning(options.returning);

            const result = await queryBuilder.execute();
            // console.log('insertBulkData result', result);

            const affected = result?.raw?.length;
            debug(`Inserted ${affected} rows into ${this.entity?.name || '?'}`);
            return;
        }
        debug(`Empty data. Skipped inserting into ${this.entity?.name || '?'}`);
    }

    async truncate() {
        try {
            const repository = this.getRepository();
            const query = repository.createQueryBuilder().delete();
            const result = await query.execute();
            debug(`Deleted ${result.affected} rows`);
        } catch (error) {
            debug(error);
        }
    }
}
