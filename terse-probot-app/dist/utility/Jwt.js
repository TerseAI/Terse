"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Jwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class Jwt {
    async sign(username) {
        return jsonwebtoken_1.default.sign({ username }, process.env.JWT_SECRET);
    }
}
exports.Jwt = Jwt;
