"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isPlainObject(v) {
    return Object.prototype.toString.call(v) === '[object Object]';
}
function omitDeep(value, keys) {
    if (typeof value === 'undefined') {
        return {};
    }
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            value[i] = omitDeep(value[i], keys);
        }
        return value;
    }
    if (!isPlainObject(value)) {
        return value;
    }
    if (typeof keys === 'string') {
        keys = [keys];
    }
    if (!Array.isArray(keys)) {
        return value;
    }
    for (let j = 0; j < keys.length; j++) {
        delete value[keys[j]];
    }
    for (let key in value) {
        if (value.hasOwnProperty(key)) {
            value[key] = omitDeep(value[key], keys);
        }
    }
    return value;
}
exports.default = omitDeep;
