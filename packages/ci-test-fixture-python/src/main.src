from terse_sdk import Terse, TerseAgent
from terse_sdk.types.events import WebhookTrigger

from terse_generated import Webhook

app = Terse()


@app.job(
    name="Tell me a joke",
    triggers=[Webhook.on_request()],
    skills=[],
)
def run_job(event: WebhookTrigger, agent: TerseAgent, /) -> None:
    agent.run_and_wait("Tell me a funny joke")
