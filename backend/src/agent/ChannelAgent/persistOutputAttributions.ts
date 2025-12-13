import { db } from "../../prismaClient";
import { Identifiable } from "../../rag/Hydrator";
import { IdentifiableStore } from "../../rag/IdentifiableStore";
import { RunHistoryAction } from "../../shared/RunHistoryTypes";
import { convertConfigTypeToOutputConfigType } from "../../utility/typeConverters";
import chalk from "chalk";

export async function persistOutputAttributions(
    automationId: string,
    sourceItemRef: Identifiable,
    action: RunHistoryAction
): Promise<void> {
    try {
        // Use output_items from the action if available
        if (!action.output_items || action.output_items.length === 0) {
            return;
        }

        const identifiableStore = new IdentifiableStore({ userId: '' });
        const identifiableRef = await identifiableStore.store(sourceItemRef);

        await db().output_change_attributions.createMany({
            data: action.output_items.map(item => ({
                automation_id: automationId,
                source_item_ref_id: identifiableRef.id,
                output_item_id: item.output_item_id,
                output_item_type: convertConfigTypeToOutputConfigType(item.output_item_type)
            })),
            skipDuplicates: true
        });

    } catch (error) {
        console.error(chalk.yellow('Failed to persist output attribution'), error);
    }
}

