import { IntegrationDetails, IntegrationInstance } from "../shared/Integrations";
import { Integration } from "../integrations/abstract/Integration";


export interface Input<T extends Integration<I, W, M>, I extends IntegrationInstance, W, M extends IntegrationDetails> {
    
}