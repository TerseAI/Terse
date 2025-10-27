import { useState } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { IntegrationBox, IntegrationInput } from "./components/Integration";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { BoltIcon } from "@heroicons/react/24/outline";

export function InputsSection() {
  const { inputs, setInputs } = useAutomationContext();

  return (
    <SectionLayout
      title="Listen For Events"
      subtitle="Choose which integrations trigger this automation"
      icon={<BoltIcon className="w-5 h-5 text-[theme(--color-accent)]" />}
    >
      {inputs.length === 0 ? (
        <div className="text-center py-4 px-4">
          <p className="text-xs text-[theme(text-secondary)] mb-3">
            No event sources yet. Add an integration to get started.
          </p>
          <AddInputButton />
        </div>
      ) : (
        <>
          {inputs.map((input) => (
            <IntegrationInput
              key={input.integration}
              input={input}
              onRemove={() => setInputs(inputs.filter((i) => i.integration !== input.integration))}
            />
          ))}
          <AddInputButton />
        </>
      )}
    </SectionLayout>
  );
}

export function AddInputButton() {
  const { inputs, setInputs } = useAutomationContext();
  const [isOpen, setIsOpen] = useState(false);

  const handleAddInput = (integration: Integration) => {
    const newInput: Input = { integration };
    setInputs([...inputs, newInput]);
    setIsOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
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

      <AddInputModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelectIntegration={handleAddInput}
      />
    </>
  );
}
