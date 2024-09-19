import { Input } from "@cliffy/prompt";

type PromptConfirmationParams = {
  message: string;
  default?: boolean;
};

const validConfirmationInputs = ["y", "yes", "n", "no"];

export async function promptConfirmation(params: PromptConfirmationParams) {
  const _default = params.default ?? false;
  const defaultInput = _default === true ? "y" : "n";
  const choices = _default === true ? "Y/n" : "y/N";
  const message = `${params.message} [${choices}]`;

  const input = await Input.prompt({
    message,
    validate: (input) => {
      if (validConfirmationInputs.includes(input.toLowerCase())) {
        return true;
      }
      return "Please enter 'y(es)' or 'n(o)'.";
    },
    default: defaultInput,
  });
  switch (input.toLowerCase()) {
    case "y":
    case "yes":
      return true;
    case "n":
    case "no":
      return false;
    default:
      throw new Error("promptConfirmation: unreachable");
  }
}

export function printErrorHeaderAndMessages(
  header: string,
  messages: string[],
) {
  console.error(`${header}:`);
  for (const msg of messages) {
    console.error(`  * ${msg}`);
  }
}
