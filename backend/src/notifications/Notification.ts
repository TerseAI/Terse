import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { User, Channel } from "../types/prisma";

// export class NotificationManagerFactory {
//     private user: User;
//     constructor(user: User) {
//         this.user = user;
//     }

//     createNotificationManager(): NotificationManager {
//         return new NotificationManager();
//     }
// }

export class NotificationManager {
    private user: User;

    constructor(user: User) {
        this.user = user;
    }

    notify(channel: Channel, runAction: RunHistoryAction) {
        console.log(runAction);
    }
}