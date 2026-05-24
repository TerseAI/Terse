import { Request, Response } from "express"

import { getAuthProvider } from "../../services/authProvider"

export async function login(req: Request, res: Response) {
    await getAuthProvider().login(req, res)
}

export async function loginUrl(req: Request, res: Response) {
    await getAuthProvider().loginUrl(req, res)
}

export async function logoutUrl(req: Request, res: Response) {
    await getAuthProvider().logoutUrl(req, res)
}

export async function logout(req: Request, res: Response) {
    await getAuthProvider().logout(req, res)
}

export async function me(req: Request, res: Response) {
    await getAuthProvider().me(req, res)
}

export async function callback(req: Request, res: Response) {
    await getAuthProvider().callback(req, res)
}

export async function getWorkOSWidgetToken(req: Request, res: Response) {
    await getAuthProvider().getWorkOSWidgetToken(req, res)
}
