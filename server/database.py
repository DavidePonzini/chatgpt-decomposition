from dav_tools import database
from task import Task

from typing import Literal


schema = 'problem_decomposition'

db = database.PostgreSQL(database='postgres',
                         host='127.0.0.1',
                         user='problem_decomposition_admin',
                         password='decomp')

def create_tree(name: str, description: str, user_id: str) -> int:
    '''Create a tree and get its id'''

    with db.connect() as c:
        result = c.insert(schema, 'trees', {'user_id': user_id}, return_fields=['tree_id'])
        tree_id = result[0][0]

        c.insert(schema, 'tree_nodes', {
            'tree_id': tree_id,
            'order_n': 1,
            'user_id': user_id,
            'creation_mode': 'manual',
            'name': name,
            'description': description,
        })

        c.commit()

        return tree_id

def save_tree(tree_id: int, user_id: str, tree: Task) -> None:
    '''
        Save current tree state for trees you own, otherwise create a new tree
    
        :param tree: can be any task of the tree
    '''

    return

    base_query = 'SELECT user_id FROM {schema}.trees WHERE tree_id = {tree_id}'
    query = database.sql.SQL(base_query).format(
        schema=database.sql.Identifier(schema),
        tree_id=database.sql.Placeholder('tree_id'),
    )

    result = db.execute_and_fetch(query, {
        'tree_id': tree_id
    })

    if len(result) > 0:
        tree_owner = result[0][0]
    else:
        tree_owner = None

    # Create a new tree if the user is not the owner
    if tree_owner is None or tree_owner != user_id:
        tree_id = create_tree(tree, user_id)

    root_task = tree.get_root()

    base_query = '''
        UPDATE {schema}.trees
        SET
            tree_data = {tree_data},
            root_task_name = {root_task_name},
            last_save_ts = NOW()
        WHERE tree_id = {tree_id}
        '''

    query = database.sql.SQL(base_query).format(
        schema=database.sql.Identifier(schema),
        tree_data=database.sql.Placeholder('tree_data'),
        root_task_name=database.sql.Placeholder('root_task_name'),
        tree_id=database.sql.Placeholder('tree_id'),
    )

    db.execute(query, {
        'tree_id': tree_id,
        'root_task_name': root_task.name,
        'tree_data': root_task.to_json(),
    })

    return tree_id

def add_node(tree_id: int, parent_id: int, name: str, description: str, user_id: str, creation_mode: Literal['manual', 'ai', 'mixed']):
    '''Adds a new node as the last child of `parent_id` for tree `tree_id`'''
    with db.connect() as c:
        select_max_order_n = '''
            SELECT MAX(order_n)
            FROM tree_nodes
            WHERE parent_id = {parent_id} AND deleted = FALSE
            '''
        
        select_max_order_n = database.sql.SQL(select_max_order_n).format({
            parent_id: database.sql.Placeholder('parent_id')
        })

        c.execute(select_max_order_n, {'parent_id': parent_id})
        max_order_n = c.fetch_one()[0]

        c.insert(schema, 'tree_nodes', {
            'parent_id': parent_id,
            'tree_id': tree_id,
            'order_n': max_order_n + 1 if max_order_n is not None else 1,
            'user_id': user_id,
            'name': name,
            'description': description,
            'creation_mode': creation_mode,
        })

        c.commit()

def get_tree(tree_id) -> str:
    base_query = 'SELECT tree_data FROM {schema}.trees WHERE tree_id = {tree_id}'

    query = database.sql.SQL(base_query).format(
        schema=database.sql.Identifier(schema),
        tree_id=database.sql.Placeholder('tree_id')
    )

    result = db.execute_and_fetch(query, {
        'tree_id': tree_id
    })

    if len(result) > 0:
        return result[0][0]
    return None


def log_decomposition(tree_id: int, user_id: str, task: Task, subtasks_amount: int, answer, usage) -> int:
    tree_id = save_tree(tree_id, user_id, task)

    decomposition_id = db.insert(schema, 'decompositions', {
        'tree_id': tree_id,

        'task_name': task.name,
        'task_level': task.level(),
        'task_id': task.id(),
        'subtasks_amount': subtasks_amount,
        'answer': answer,
        
        'prompt_tokens': usage.prompt_tokens,
        'completion_tokens': usage.completion_tokens
    },
    return_fields=['decomposition_id'])

    return decomposition_id[0][0], tree_id

def log_implementation(tree_id: int, user_id: str, decomposition_id: int, task: Task, language, answer, usage) -> int:
    tree_id = save_tree(tree_id, user_id, task)

    implementation_id = db.insert(schema, 'implementations', {
        'tree_id': tree_id,
        'decomposition_id': decomposition_id,

        'task_name': task.name,
        'task_level': task.level(),
        'task_id': task.id(),
        'implementation_language': language,
        'answer': answer,

        'prompt_tokens': usage.prompt_tokens,
        'completion_tokens': usage.completion_tokens 
    },
    return_fields=['implementation_id'])


    return implementation_id[0][0], tree_id


def log_feedback_decomposition(decomposition_id: int, user_id: str, q1, q2, q3, q4, comments):
    db.insert(schema, 'feedback_decompositions', {
        'decomposition_id': decomposition_id,

        'user_id': user_id,

        'q1': q1,
        'q2': q2,
        'q3': q3,
        'q4': q4,
        'comments': comments if len(comments) > 0 else None
    })

def check_user_exists(user_id: str):
    base_query = 'SELECT COUNT(*) FROM {schema}.users WHERE user_id = {user_id}'

    query = database.sql.SQL(base_query).format(
        schema=database.sql.Identifier(schema),
        user_id = database.sql.Placeholder('user_id')
    )

    result = db.execute_and_fetch(query, {
        'user_id': user_id
    })

    return result[0][0] == 1


