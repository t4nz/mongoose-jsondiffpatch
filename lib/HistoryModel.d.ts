import { Document, Schema } from 'mongoose';
export interface HistoryDocument extends Document {
    collectionName: string;
    collectionId: Schema.Types.ObjectId;
    diff: {
        [key: string]: any;
    };
    user?: object;
    reason?: string;
    version: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}
export declare const HistorySchema: Schema;
export default HistorySchema;
