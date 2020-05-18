import { inject, injectable, named } from 'inversify';
import { Memento, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IDisposableRegistry, IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { INotebookEditor, INotebookEditorProvider } from '../types';

const MEMENTO_KEY = 'nativeEditorViewTracking';
@injectable()
export class NativeEditorViewTracker implements IExtensionSingleActivationService {
    constructor(
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private readonly workspaceMemento: Memento,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        disposableRegistry.push(editorProvider.onDidOpenNotebookEditor(this.onOpenedEditor.bind(this)));
        disposableRegistry.push(editorProvider.onDidCloseNotebookEditor(this.onClosedEditor.bind(this)));
    }

    public async activate(): Promise<void> {
        // On activate get the list and eliminate any dupes that might have snuck in.
        const set = new Set<string>(this.workspaceMemento.get<string[]>(MEMENTO_KEY) || []);
        await this.workspaceMemento.update(MEMENTO_KEY, undefined);

        // Then open each one.
        set.forEach((l) => {
            const uri = Uri.parse(l);
            if (uri) {
                this.editorProvider.open(uri).ignoreErrors();
            }
        });
    }

    private onOpenedEditor(editor: INotebookEditor) {
        // Save this as a file that should be reopened in this workspace
        const list = this.workspaceMemento.get<string[]>(MEMENTO_KEY) || [];
        const fileKey = editor.file.toString();
        if (!list.includes(fileKey)) {
            this.workspaceMemento.update(MEMENTO_KEY, [...list, fileKey]);
        }
    }

    private onClosedEditor(editor: INotebookEditor) {
        // Save this as a file that should not be reopened in this workspace
        const list = this.workspaceMemento.get<string[]>(MEMENTO_KEY) || [];
        const fileKey = editor.file.toString();
        this.workspaceMemento.update(
            MEMENTO_KEY,
            list.filter((e) => e !== fileKey)
        );
    }
}
