import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// Main components
let tree_data = null;
let tree_id = null;
let last_update = null;
let feedback_list = [];
let expanded_tasks = [];

const svg = d3.select('#tree');
const g = svg.append('g');

const SERVER_ADDR = '15.237.153.101:5000';

window.disable_feedback = false;


// --------------------------------------------------------------------------
// Handle zoom
let zoom = d3.zoom().on('zoom', function(e) {
    $('#task-data').modal('hide');
    g.attr('transform', e.transform);
});
svg.call(zoom);


function focus_root() {
    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
}

$(document).ready(function() {
    // Make dummy tree
    let tree = new Task(null, null, null, null, 'Load an existing task or create a new one', '');

    init(JSON.stringify(tree.toJSON()));
    show_all_children(tree);
})

function new_tree() {
    if (!check_user_id())
        return;

    let name = $('#new-task-name').val();
    let description = $('#new-task-description').val();

    $.ajax({
        type: 'POST',
        url: `http://${SERVER_ADDR}/create-tree`,
        data: {
            'user_id': JSON.stringify(user_id),
            'name': JSON.stringify(name),
            'description': JSON.stringify(description),
        },
        success: function(d) {
            let data = d;
            
            if (data.status && data.status == 'invalid_request') {
                throw Error(data.message);
            }
            
            init(data.tree, data.tree_id, data.last_update, data.feedback_list);
        },
        error: console.error
    });

    $('#new-tree-modal').modal('hide');
}

function load_from_server(cb = () => {}) {
    if (!check_user_id())
        return;

    let tree_id = +prompt('Insert tree ID:');
    if (!tree_id)
        return;

    load_from_server_id(tree_id, cb);
}

function load_from_server_id(tree_id, cb = () => {}) {
    if (!check_user_id())
        return;

    if (isNaN(tree_id)) {
        alert('Invalid ID format, please try again.');
        return;
    }

    $.ajax({
        type: 'POST',
        url: `http://${SERVER_ADDR}/load-tree`,
        data: {
            'user_id': JSON.stringify(user_id),
            'tree_id': JSON.stringify(tree_id),
        },
        success: function(d) {
            if (d.status && d.status == 'error') {
                alert('Invalid tree ID.');
                return;
            }

            init(d.tree, tree_id, d.last_update, d.feedback_list, expanded_tasks);

            cb();
        },
        error: console.error
    });
}

function init(tree_json, _tree_id = null, _last_update = null, _feedback_list = [], _expanded_tasks = []) {
    let tree = Task.load_from_json(tree_json, null, _expanded_tasks);

    tree_data = tree;
    set_tree_id(_tree_id);
    last_update = _last_update;
    feedback_list = _feedback_list;
    expanded_tasks = _expanded_tasks;
    
    draw();

    // Useful for debugging, should be eventually removed
    window.data = tree;
}

function set_tree_id(id) {
    tree_id = id;

    if (tree_id)
        $('#task-button').text(`Task [${tree_id}]`);
    else
        $('#task-button').text(`Task`);
}

function draw() {
    const svg_width = $('#tree').innerWidth();

    const margin = {
        left: 50,
        right: 200,
        top: 50,
        bottom: 200
    };

    const width = svg_width - margin.left - margin.right;
    const max_label_length = 150;

    const treeLayout = d3.tree(null).nodeSize([200, 200]);
    const treeData = treeLayout(d3.hierarchy(tree_data, d => d.children));

    // -------------------------------------------------------------------------------------------------------------
    // Nodes
    // -------------------------------------------------------------------------------------------------------------
    let nodes = g.selectAll('.node')
        .data(treeData.descendants())

    // Nodes - Enter
    let nodesG_enter = nodes.enter().append('g')
        .classed('node', true)
        .classed('node-internal', d => !d.data.is_leaf())
        .classed('node-leaf', d => d.data.is_leaf())
        .classed('unexplored', d => d.data.is_unexplored())
        .classed('explored', d => d.data.is_explored())
        .classed('implemented', d => d.data.implementation)
        .classed('solved', d => d.data.is_solved())
        .classed('running', d => d.data.running)
        .classed('feedback-required', d => feedback_list.includes(d.data.task_id) && !window.disable_feedback)
        .attr('transform', d => `translate(${d.x + width/2 + margin.left}, ${d.y + margin.top})`)
        .on('click', onNodeClick);
    nodesG_enter.append('circle')
        .attr('r', 10);
    nodesG_enter.append('text')
        .attr('dx', 18)
        .attr('dy', '.31em')
        .each(function (d) {
            let name = d.data.name;
            let elem = d3.select(this);
            
            elem.text(name);

            // skip root node, we always have infinite space
            if (d.data.is_root())
                return;

            while (this.getComputedTextLength() > max_label_length) {
                name = name.substr(0, name.length - 1);
                elem.text(name + '...');
            }
        });

    // Nodes - Update
    let nodesG_update = nodes
        .classed('node-internal', d => !d.data.is_leaf())
        .classed('node-leaf', d => d.data.is_leaf())
        .classed('unexplored', d => d.data.is_unexplored())
        .classed('explored', d => d.data.is_explored())
        .classed('implemented', d => d.data.implementation)
        .classed('solved', d => d.data.is_solved())
        .classed('running', d => d.data.running)
        .classed('feedback-required', d => feedback_list.includes(d.data.task_id) && !window.disable_feedback)
        .attr('transform', d => `translate(${d.x + width/2 + margin.left}, ${d.y + margin.top})`)
        .on('click', onNodeClick);
    nodesG_update.select('text')
        .each(function (d) {
            let name = d.data.name;
            let elem = d3.select(this);
            
            elem.text(name);

            // skip root node, we always have infinite space
            if (d.data.is_root())
                return;

            while (this.getComputedTextLength() > max_label_length) {
                name = name.substr(0, name.length - 1);
                elem.text(name + '...');
            }
        });

    // Nodes - Exit
    nodes.exit().remove('g');

    // -------------------------------------------------------------------------------------------------------------
    // Links
    // -------------------------------------------------------------------------------------------------------------
    let links = g.selectAll('.link')
        .data(treeData.links());

    // Links - Enter
    let links_enter = links.enter().append('path')
        .classed('link', true)
        .classed('link-internal', d => !d.target.data.is_leaf())
        .classed('link-leaf', d => d.target.data.is_leaf())
        .classed('unexplored', d => d.target.data.is_unexplored())
        .classed('explored', d => d.target.data.is_explored())
        .classed('implemented', d => d.target.data.implementation)
        .classed('solved', d => d.target.data.is_solved())
        .classed('feedback-required', d => feedback_list.includes(d.target.data.task_id) && !window.disable_feedback)
        .attr('d', d3.linkVertical()
        .source(d => [
            d.source.x + width/2 + margin.left,
            d.source.y + margin.top + 10.5
        ])
        .target(d => [
            d.target.x + width/2 + margin.left,
            d.target.y + margin.top - 10.5   // 10 = circle radius; .5 = stroke width / 2
        ])
    )

    // Links - Update
    let links_update = links;
    links_update
        .classed('link-internal', d => !d.target.data.is_leaf())
        .classed('link-leaf', d => d.target.data.is_leaf())
        .classed('unexplored', d => d.target.data.is_unexplored())
        .classed('explored', d => d.target.data.is_explored())
        .classed('implemented', d => d.target.data.implementation)
        .classed('solved', d => d.target.data.is_solved())
        .classed('feedback-required', d => feedback_list.includes(d.target.data.task_id) && !window.disable_feedback)
        .attr('d', d3.linkVertical()
        .source(d => [
            d.source.x + width/2 + margin.left,
            d.source.y + margin.top + 10.5
        ])
        .target(d => [
            d.target.x + width/2 + margin.left,
            d.target.y + margin.top - 10.5   // 10 = circle radius; .5 = stroke width / 2
        ])
    )

    // Links - Exit
    links.exit().remove('path');

    // Update feedback counter
    let feedback_count = $('g.feedback-required').length;
    let feedback_button = $('#feedback-count');
    if (feedback_count > 0  && !window.disable_feedback) {
        feedback_button.text(`You can provide feedback for ${feedback_count} task(s)`)
        feedback_button.show();
    } else {
        feedback_button.hide();
    }

}

function onNodeClick(event, item) {
    // Prevent any action if API is generating output
    if ($('.running').length > 0) {
        return;
    }

    // Prevent any action for sample tree
    if (!tree_id) {
        return;
    }

    // Set name
    let name = $('#task-name');
    name.text(`${item.data.name}`);

    // Set description
    let description = $('#task-description');
    description.text(item.data.description);
    
    // Set implementation, if available
    let impl = $('#task-implementation');
    if (item.data.implementation && item.data.implementation_language) {
        impl.show();
        let impl_text = $('#task-implementation-text');
        impl_text.text(item.data.implementation.split('\n').slice(1, -1).join('\n'));       // remove first and last line (```python & ```)
        impl_text.attr('class', `language-${item.data.implementation_language}`);

        // highligth element (since the same html elem will be used, we need to unset data-highlighted)
        impl_text.removeAttr('data-highlighted');
        hljs.highlightElement(impl_text[0]);
    } else {
        impl.hide()
    }

    // Hide manual decomposition prompt
    $('#task-decomposition-manual').hide();

    // Show decomposition feedback, if needed
    if (feedback_list.includes(item.data.task_id) && !window.disable_feedback) {
        prepare_feedback_decomposition(item);
        $('#task-feedback-decomposition').show();
    } else {
        $('#task-feedback-decomposition').hide();
    }

    // Show appropriate buttons for current task
    show_buttons(item);

    // Make the modal visible
    show_task_data_modal();
}

function prepare_feedback_decomposition(item) {
    // Reset all select options
    let questions = $('#task-feedback-decomposition select');
    questions.val(0);

    // hide question about decomposition if task has no children
    if (!item.data.has_children()) {
        $('#task-feedback-decomposition-q3').val(-1);
        $('#task-feedback-decomposition-q3-all').hide();
    } else {
        $('#task-feedback-decomposition-q3-all').show();
    }

    $('#task-feedback-decomposition-submit').prop('disabled', false).unbind().on('click', function() {
        if (!check_user_id())
            return;

        let missing_anwer = false;
        
        // Show feedback for missing answers
        for (let question of questions) {
            question = $(question);
            if (question.val() == 0) {
                question.addClass('is-invalid');
                missing_anwer = true;
            } else {
                question.removeClass('is-invalid');
            }
        }

        // if all answers have been provided, record the feedback and don't ask for it again
        if (!missing_anwer) {
            let q1 = $('#task-feedback-decomposition-q1').val();
            let q2 = $('#task-feedback-decomposition-q2').val();
            let q3 = $('#task-feedback-decomposition-q3').val();

            $.ajax({
                type: 'POST',
                url: `http://${SERVER_ADDR}/feedback`,
                data: {
                    'task_id': JSON.stringify(item.data.task_id),
                    'user_id': JSON.stringify(user_id),
                    'q1': JSON.stringify(q1),
                    'q2': JSON.stringify(q2),
                    'q3': JSON.stringify(q2),
                },
                success: function(d) {
                    $('#task-feedback-decomposition').hide();

                    update();
                },
                error: console.error
            });

            // Request sent - disable submit button
            $('#task-feedback-decomposition-submit').prop("disabled", true);
            
        }
    });
}

/**
 * Show the appropriate buttons for the given task
 */
function show_buttons(item) {
    // Show/hide decomposition: only available on decomposed tasks
    let button_show_decomposition = $('#show-decomposition');
    button_show_decomposition.text(item.data.is_leaf() ? 'Show decomposition' : 'Hide decomposition');
    if (item.data.has_children()) {
        button_show_decomposition.show().unbind().on('click', () => item.data.is_leaf() ? show_children(item.data) : hide_children(item.data));
    } else {
        button_show_decomposition.hide();
    }

    // Decompose: only available for unsolved tasks
    let button_decompose = $('#decompose');
    if (!item.data.is_solved()) {
        button_decompose.show();
        $('#decompose-manual').unbind().on('click', () => manual_decomposition(item));
        $('#decompose-ai').unbind().on('click', () => generate_decomposition(item));

        // Delete decomposition: available on nodes that have children
        let button_delete = $('#delete-decomposition');
        if (item.data.has_children()) {
            button_delete.show().unbind().on('click', () => delete_children(item));
        } else {
            button_delete.hide();
        }
    } else {
        button_decompose.hide();
    }

    // Implement: only available on unsolved tasks that can be implemented
    let button_implement = $('#implement');
    if (!item.data.is_solved() && item.data.can_be_implemented()) {
        button_implement.show();
        $('#implement-py').unbind().on('click', () => implement_task(item, 'python'));
        $('#implement-js').unbind().on('click', () => implement_task(item, 'javascript'));
        $('#implement-delete').unbind().on('click', () => delete_implementation(item));
    } else {
        button_implement.hide();
    }

    // Solve/unsolve: available on all tasks, depending on whether they've been solved
    let button_solve = $('#solve');
    let button_unsolve = $('#unsolve');
    if (item.data.is_solved()) {
        button_solve.hide();
        button_unsolve.show().unbind().on('click', () => solve(item, false));
    } else {
        button_solve.show().unbind().on('click', () => solve(item, true));
        button_unsolve.hide();
    }
}

function generate_decomposition(item) {
    hide_buttons();

    if (!check_user_id())
        return;    

    let task = item.data;

    task.generate_decomposition(user_id, function() {
        task.running = false;

        // show this task after refresh
        expanded_tasks.push(task.task_id);

        update();
    }, function(e) {
        console.error(e);
        task.running = false;
        alert('error, see console for info');
        draw();
    });

    item.data.running = true;
    draw();
}

function manual_decomposition(item) {
    if (!check_user_id())
        return;

    // Clear the list
    $('#task-decomposition-manual-tasks > div').remove();
    
    let subtasks = item.data.subtasks;
    if (subtasks.length) {
        for (let subtask of subtasks)
            manual_decomposition_add_button(subtask.task_id, subtask.name, subtask.description);
    } else {
        manual_decomposition_add_button(null, '', '');
    }

    // Make the list sortable
    $("#task-decomposition-manual-tasks").sortable().disableSelection();

    // Bind functionality to "add subtask" button
    $('#task-decomposition-manual-add-subtask').unbind().on('click', () => manual_decomposition_add_button(null, '', ''));

    $('#task-decomposition-manual-submit').unbind().on('click', () => submit_manual_decomposition(item));
    $('#task-decomposition-manual').show();
}

function manual_decomposition_add_button(task_id, name, description) {
    let div = $('<div class="list-group-item list-group-item-action list-group-item-light"></div>');
    
    let div_title = $('<div style="display: flex"></div>');
    let label1 = $('<label class="form-label"><b>Name:</b></label>');
    let sort = $('<i class="fa-solid fa-sort" style="margin: 0 0 0 auto; padding: .25em"></i>');
    let close = $('<button type="button" class="btn-close" aria-label="Close" style="margin: 0 0 0 .5em;"></button>');
    close.on('click', () => div.remove());

    div_title.append(label1).append(sort).append(close);

    let input1 = $('<input type="text" class="form-control">');
    input1.val(name);
    input1.attr('task_id', task_id);        // task_id is embedded here for simplicity 

    let label2 = $('<label class="form-label mt-3"><b>Description:</b></label>');
    let input2 = $('<textarea class="form-control" rows="3"></textarea>');
    input2.val(description);

    div.append(div_title).append(input1).append(label2).append(input2);
    
    let button = $('#task-decomposition-manual-add-subtask');
    div.insertBefore(button);
}

function submit_manual_decomposition(item) {
    let subtasks = [];

    let elems = $('#task-decomposition-manual-tasks > div');
    for (let elem of elems) {
        let name = $(elem).find('input').val();
        let task_id = $(elem).find('input').attr('task_id');
        let description = $(elem).find('textarea').val();

        subtasks.push({
            'task_id': task_id ? task_id : null,
            'name': name,
            'description': description,
        })
    }    

    // Mark this task for expansion after update
    expanded_tasks.push(item.data.task_id);

    hide_buttons();
    
    $.ajax({
        type: 'POST',
        url: `http://${SERVER_ADDR}/update-tasks`,
        data: {
            'parent_id': JSON.stringify(item.data.task_id),
            'user_id': JSON.stringify(user_id),
            'tasks': JSON.stringify(subtasks),
        },
        success: update,
        error: function(e) {
            console.error(e);
            item.data.running = false;
            alert('error, see console for info');
        }
    });
    

}


function delete_implementation(item) {
    item.data.remove_implementation(user_id, update, function(e) {
        console.error(e);
        item.data.running = false;
        alert('error, see console for info');
    });

    hide_buttons();
}


function implement_task(item, language) {
    hide_buttons();

    if (!check_user_id())
        return;    

    item.data.generate_implementation(user_id, language, null, update, function(e) {
        console.error(e);
        item.data.running = false;
        alert('error, see console for info');
    });

    item.data.running = true;
    draw();
}

function show_task_data_modal() {
    $('#task-data').modal('show');
}

function hide_buttons() {
    $('#task-data').modal('hide');
}

function delete_children(item) {
    hide_buttons();

    $.ajax({
        type: 'POST',
        url: `http://${SERVER_ADDR}/update-tasks`,
        data: {
            'parent_id': JSON.stringify(item.data.task_id),
            'user_id': JSON.stringify(user_id),
            'tasks': JSON.stringify([]),
        },
        success: update,
        error: console.error
    });
}

function solve(item, solved) {
    hide_buttons();

    $.ajax({
        type: 'POST',
        url: `http://${SERVER_ADDR}/solve`,
        data: {
            'user_id': JSON.stringify(user_id),
            'task_id': JSON.stringify(item.data.task_id),
            'solved': JSON.stringify(solved)
        },
        success: update,
        error: console.error
    });
}

function show_children(task) {
    hide_buttons();

    task.show_children(false, (t) => expanded_tasks.push(t.task_id));
    draw();
}

function hide_children(task) {
    hide_buttons();

    task.hide_children(false, (t) => expanded_tasks.splice(expanded_tasks.indexOf(t.task_id)));
    draw();
}

function show_all_children() {
    tree_data.show_children(true, (t) => expanded_tasks.push(t.task_id));
    draw();
window.expanded_tasks = expanded_tasks;
}

function hide_all_children() {
    tree_data.hide_children(true, (t) => expanded_tasks.splice(expanded_tasks.indexOf(t.task_id)));
    draw();
}

function check_for_update() {
    if (!tree_id)
        return;

    // TODO: check if server.last_edit > local.last_edit

    update();
}

function update() {
    if (!tree_id)
        return;

    load_from_server_id(tree_id);
    update_user_data();
}

window.draw = draw;
window.update = update;
window.new_tree = new_tree;
window.load = load_from_server;
window.load_id = load_from_server_id;
window.show_all_children = show_all_children;
window.hide_all_children = hide_all_children;
window.focus_root = focus_root;