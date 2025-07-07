"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectraInterface = void 0;
const axios_1 = __importDefault(require("axios"));
const Jwt_js_1 = require("./utility/Jwt.js");
const backendBaseUrl = process.env.VECTRA_BACKEND_URL || 'http://localhost:3001';
exports.VectraInterface = {
    async githubAppInstallationCallback(name, email, username, installationId, repositoryName) {
        const token = await new Jwt_js_1.Jwt().sign(username);
        return axios_1.default.post(`${backendBaseUrl}/github/installation-callback`, {
            name,
            email,
            username,
            installationId,
            repositoryName
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
            return response.data;
        })
            .catch(error => {
            console.error('GitHub installation callback failed:', error);
            throw error;
        });
    },
    async githubAppInstallationDeleted(username, installationId) {
        const token = await new Jwt_js_1.Jwt().sign(username);
        return axios_1.default.post(`${backendBaseUrl}/github/installation-deleted`, {
            username,
            installationId,
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },
    async githubPushEvent(username, installationId, repositoryName, branch, commits) {
        const token = await new Jwt_js_1.Jwt().sign(username);
        return axios_1.default.post(`${backendBaseUrl}/github/push-event`, {
            username,
            installationId,
            repositoryName,
            branch,
            commits
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    }
};
