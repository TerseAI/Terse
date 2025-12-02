import { users } from "@prisma/client";

export class NotificationManagerFactory {
    private user: users;
    constructor(user: users) {
        this.user = user;
    }

    createNotificationManager(): NotificationManager {
        return new NotificationManager();
    }
}
export class NotificationManager {
    constructor() {}

    notify(message: string) {
        console.log(message);
    }
}

interface NotificationChannel {

}