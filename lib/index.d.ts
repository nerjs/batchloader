
type BatchOptions = {
    maxSize: number,
    cacheTime: number,
    batchTime: number,

    /**
     * build key
     * @param dataKey argument for BatchLoader.load()
     */
    getKey: (dataKey: any) => any,
}

declare class BatchLoader {
    constructor(
        batchLoaderFn:(batches:Array<any>) => Promise<Array<any>>, 
        options?: BatchOptions
    );

    load(data: any): Promise<any>;

    loadMany(dataArr: Array<any>): Promise<any>;

    /**
     * Clear cache
     * @param keyData data for build key.
     */
    clear(keyData: any): undefined;

    /**
     * Clear all cache
     */
    clearAll(): undefined;

    /**
     * resolve one wait promise
     * @param keyData data for build key
     */
    resolve(keyData: any, result: any): undefined;

    /**
     * reject one wait promise.
     * @param keyData data for build key
     */
    reject(keyData: any, error: Error): undefined;
}

export = BatchLoader
