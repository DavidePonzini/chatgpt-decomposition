from dav_tools import messages
from openai import OpenAI

client = OpenAI()


class MessageRole:
    USER = 'user'
    ASSISTANT = 'assistant'
    SYSTEM = 'system'

class Message:
    def __init__(self) -> None:
        self.messages = []
        self.usage = []

    def add_message(self, role: str, message):
        self.messages.append({
            'role': role,
            'content': message
        })

    def generate_answer(self, *, require_json=False, add_to_messages=True, temperature=1, top_p=0.1, frequency_penalty=0) -> str:
        """
        Generates an answer to the current conversation.

        Args:
            require_json (bool, optional): Determines the format of the response. If `True`, the response is returned as a JSON object. If `False`, the response is in plain text. Default is `False`.
            add_to_messages (bool, optional): Specifies whether the generated answer should be added to the conversation messages. If `True`, the answer is appended to `self.messages`. Default is `True`.
            temperature (float, optional): Controls the randomness of the response. Higher values (e.g., 1) make the output more random, while lower values (e.g., 0) make it more deterministic. Default is 1.
            top_p (float, optional): Controls the diversity of the response by sampling from the top `p` probability mass. Lower values restrict the model to high-probability choices. Default is 1.
            frequency_penalty (float, optional): Applies a penalty to repeated words/phrases, reducing their likelihood in the response. Higher values discourage repetition. Default is 0.

        Returns:
            str: The generated answer.
        """
        # messages.progress('Generating answer...')
        completion = client.chat.completions.create(
            model='gpt-3.5-turbo',
            messages=self.messages,
            response_format={
                'type': 'json_object' if require_json else 'text'
            },
            temperature=temperature,
            top_p=top_p,
            frequency_penalty=frequency_penalty
        )

        # messages.info('Generated answer')
        self.usage.append(completion.usage)
        # print_price(completion.usage)

        answer = completion.choices[0].message.content
    
        # Add the answer to this conversation
        if add_to_messages:
            self.add_message('assistant', answer)

        return answer

    def print(self):
        for message in self.messages:

            role = message['role']
            if role == 'system':
                color = messages.TextFormat.Color.RED
            elif role == 'assistant':
                color = messages.TextFormat.Color.YELLOW
            else:
                color = messages.TextFormat.Color.BLUE

            messages.message(message['content'], icon=message['role'],
                            icon_options=[color], default_text_options=[
                                color,
                                None if message['role'] == 'user' else messages.TextFormat.Style.ITALIC
                            ])

def print_price(usage):
    cost_in = usage.prompt_tokens / 1_000_000 * 0.50
    cost_out = usage.completion_tokens / 1_000_000 * 1.50

    messages.message(f'Cost: {(cost_in + cost_out):.5f} $ (in={usage.prompt_tokens}, out={usage.completion_tokens})',
                     icon='$', icon_options=[messages.TextFormat.Color.BLUE])



if __name__ == '__main__':
    message = Message()
    message.add_decomposition_first_message('Download and store a webpage', 'Write a python program to download and store a webpage')
    message.generate_answer()