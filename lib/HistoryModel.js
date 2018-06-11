"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
exports.HistorySchema = new mongoose_1.Schema({
    collectionName: {
        type: String,
        index: true,
    },
    collectionId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
exports.default = exports.HistorySchema;
