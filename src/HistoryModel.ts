import { Document, Schema } from 'mongoose';

export interface HistoryDocument extends Document {
  collectionName: string;
  collectionId: Schema.Types.ObjectId;
  diff: { [key: string]: any };
  user?: object;
  reason?: string;
  version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const HistorySchema = new Schema(
  {
    collectionName: {
      type: String,
      index: true,
    },
    collectionId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    diff: {},
    user: {},
    reason: String,
    version: {
      type: Number,
      min: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export default HistorySchema;
