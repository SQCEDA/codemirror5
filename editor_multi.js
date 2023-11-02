

editor_multi = function () {

    var editor_multi = {};

    var extraKeys = {
        "Ctrl-/": function (cm) { cm.toggleComment(); },
        "Ctrl-Enter": function (cm) { editor_multi.confirm(true); },
    };

    var codeEditor = CodeMirror.fromTextArea(document.getElementById("multiLineCode"), {
        lineNumbers: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: true,
        smartIndent: true,
        mode: { name: "python", version: 3},
        lineWrapping: true,
        continueComments: "Enter",
        // gutters: ["CodeMirror-lint-markers", "CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        autocomplete: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        extraKeys: extraKeys,
        // foldGutter: true,
        inputStyle: "textarea",
        highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true }
    });

    editor_multi.codeEditor = codeEditor;

    // var ctrlRelease = new Date();
    codeEditor.on("keyup", function (cm, event) {
        // var date = new Date();
        // if (event.keyCode == 17 || event.keyCode == 91) { // ctrl, cmd
        //     ctrlRelease = date;
        // }
    });

    editor_multi.id = '';

    editor_multi.show = function () {
        document.getElementById('left7').style = '';
    }
    editor_multi.hide = function () {
        document.getElementById('left7').style = 'z-index:-1;opacity: 0;';
    }

    editor_multi.indent = function (field) {
        if (typeof (editor) !== typeof (undefined) && editor && editor.mode && editor.mode.indent) return editor.mode.indent(field);
        return '\t';
    }

    var _setValue = function (val) {
        codeEditor.setValue(val || '');
    }

    editor_multi.cancel = function () {
        editor_multi.hide();
        editor_multi.id = '';
        multiLineArgs = [null, null, null];
    }

    editor_multi.confirm = function (keep) {
        if (!editor_multi.id) {
            editor_multi.id = '';
            return;
        }
        if (editor_multi.id === 'callFromBlockly') {
            editor_multi.multiLineDone(keep);
            return;
        }
    }

    var multiLineArgs = [null, null, null];
    editor_multi.multiLineEdit = function (value, b, f, args, callback) {
        editor_multi.id = 'callFromBlockly';
        _setValue(value.split('\\n').join('\n') || '');
        multiLineArgs[0] = b;
        multiLineArgs[1] = f;
        multiLineArgs[2] = callback;
        editor_multi.show();
    }
    editor_multi.multiLineDone = function (keep) {
        if (!multiLineArgs[0] || !multiLineArgs[1] || !multiLineArgs[2]) return;
        var newvalue = codeEditor.getValue() || '';
        multiLineArgs[2](newvalue, multiLineArgs[0], multiLineArgs[1])
        if (!keep) {
            editor_multi.id = '';
            editor_multi.hide();
        } else {
            console.log('写入成功！');
        }
    }

    // 字体大小
    {
        // const CONFIG_KEY = "editor_multi.fontSize";
        // let fontsize = editor.config.get(CONFIG_KEY, 14);
        let fontsize = 14;
        const input = document.getElementById("editor_multi_fontsize");
        const check = document.getElementById("editor_multi_fontweight")
        input.value = fontsize;
        editor_multi.setFontSize = function () {
            const value = Number(input.value);
            // editor.config.set(CONFIG_KEY, value);
            const ele = codeEditor.getWrapperElement()
            ele.style.fontSize = `${value}px`;
            ele.style.fontWeight = `${check.checked ? 'bold' : 'normal'}`
        }
    }

    return editor_multi;
}
//editor_multi=editor_multi();