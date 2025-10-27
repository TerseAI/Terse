import { useState } from "react";
import { Output, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { IntegrationBox, IntegrationInput } from "./components/Integration";
import { SectionLayout } from "./components/SectionLayout";
import { AddOutputModal } from "./components/AddOutputModal";
import { DocumentTextIcon } from "@heroicons/react/24/outline";

export function OutputSection() {
  const { output, setOutput } = useAutomationContext();
  return (
    <SectionLayout
      title="Update Living Document"
      subtitle="The AI will continuously update this document as events come in"
      icon={<DocumentTextIcon className="w-5 h-5 text-[theme(--color-accent-tertiary)]" />}
    >
      {output ? (
        <IntegrationInput input={output} onRemove={() => setOutput(undefined)} isOutput={true} />
      ) : (
        <div className="text-center py-4 px-4">
          <p className="text-xs text-[theme(text-secondary)] mb-3">
            Choose where your living document will be updated
          </p>
          <AddOutputButton />
        </div>
      )}
    </SectionLayout>
  );
}

function AddOutputButton() {
  const { setOutput } = useAutomationContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelectIntegration = (integration: Integration) => {
    const newOutput: Output = { integration };
    setOutput(newOutput);
    setIsModalOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        <IntegrationBox>
          <svg
            className="w-6 h-6 text-[theme(text-primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </IntegrationBox>
      </button>
      <AddOutputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectIntegration={handleSelectIntegration}
      />
    </>
  );
}
