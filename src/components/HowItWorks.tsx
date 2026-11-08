import { ColorBlock } from '@/components/brand';

const steps = [
  ["Tell us what's on your mind", 'A few quick questions about your concern, your language and your budget.'],
  ['Pick your Babalawo', 'Browse verified Babalawos. Every fee is shown up front.'],
  ['Meet on Google Meet', 'Your link arrives once payment clears. Reminders go out by WhatsApp.'],
  ['Keep your notes', 'Agreed actions and deadlines stay in your dashboard, with reminders.'],
];

const HowItWorks = () => (
  <section id="how" className="band">
    <div className="wrap">
      <h2 className="mb-9 font-display text-display-md font-extrabold">
        From question
        <br />
        to guidance.
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([title, body], i) => (
          <ColorBlock key={title} index={i} number={i + 1} title={title}>
            <p className="m-0 text-[15px]">{body}</p>
          </ColorBlock>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
