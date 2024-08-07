import json
from task import Task


class CreateName:
    instructions = '''
Each task is represented by a name and a description.
The user will provide you with the description and you need to create a short name to represent it. Names should be very short sentences that describe the action performed by the task. Provide the answer as a JSON object containing the field "name".
'''

    def prompt(description):
        return f'''
-- task --
{description}
'''

class Decomposition:
    instructions = '''
Decompose the current task into the smallest possible number of subtasks (usually two or three).
You must produce at least two subtasks and you can produce up to five subtasks.

For each subtask, provide a name as well as a description, similar to the one provided for the main problem.

Each subtask must be simpler to solve than the main task.
A subtask of a given task, should not include any elements of other tasks at the same level of decomposition.
Ensure that there are no missing steps: i.e. the sum of all subtasks solves the entire task.

Format the result in JSON: provide a list of objects such as this: {"result": [{"name":"the subtask's name", "description": "the subtask's description"}, ...]}'''
    
    @staticmethod
    def prompt(task: Task):
        if task.is_root():
            return f'-- Problem description --\n{json.dumps({"name": task.name, "description": task.description})}' 
        return f'Using the same approach, decompose the task "{task.name}"'
    

class Implementation:
    instructions = ''''From now on, you need to implement the following tasks.
Provide the answer as a string.'''

    @staticmethod
    def prompt(task: Task, language: str):
        return f'''Implement, using {language}, the task "{task.name}" ({task.description}).
If possible, use the functions you previously developed. You don't need to write their implementation again.'''
    
    @staticmethod
    def prompt_refine(task: Task, language: str, instructions: str):
        return instructions
