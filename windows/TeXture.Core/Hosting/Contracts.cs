using System;
using System.Collections.Generic;

namespace TeXture.Core.Hosting
{
    public enum HostKind { PowerPoint, Word }

    /// <summary>An equation found in the document, as sent to the editor UI.</summary>
    public sealed class EquationInfo
    {
        /// <summary>Opaque, host-specific address used to find the shape again (survives selection changes).</summary>
        public string Key { get; set; }
        public string Latex { get; set; }
        /// <summary>Effective font size in pt, already corrected for manual resizing; null for legacy equations.</summary>
        public double? FontSize { get; set; }
        public string Color { get; set; }
        /// <summary>True when the equation was written by v1.2.x (no size/colour metadata).</summary>
        public bool IsLegacy { get; set; }

        public Dictionary<string, object> ToMessage() => new Dictionary<string, object>
        {
            ["key"] = Key,
            ["latex"] = Latex,
            ["fontSize"] = FontSize,
            ["color"] = Color,
            ["legacy"] = IsLegacy,
        };
    }

    /// <summary>What is selected in the document right now.</summary>
    public sealed class SelectionState
    {
        public static readonly SelectionState Empty = new SelectionState();

        public EquationInfo Equation { get; set; }
        /// <summary>Optional hint for the status bar, e.g. "Group contains 3 equations".</summary>
        public string Note { get; set; }
    }

    public sealed class InsertRequest
    {
        public string Latex { get; set; }
        public string Svg { get; set; }
        public double FontSize { get; set; }
        public string Color { get; set; }
        /// <summary>Key of the equation to replace; null inserts a new equation.</summary>
        public string TargetKey { get; set; }

        /// <summary>For a new equation: place it next to this equation ("insert as new" while editing).</summary>
        public string NearKey { get; set; }
    }

    public sealed class InsertResult
    {
        public EquationInfo Equation { get; set; }
        /// <summary>User-facing notice (e.g. the original could not be found and a new one was inserted).</summary>
        public string Notice { get; set; }
        /// <summary>Host object for the inserted shape, used to put the selection back on it.</summary>
        public object NativeShape { get; set; }
    }

    public sealed class SelectionChangedEventArgs : EventArgs
    {
        public SelectionChangedEventArgs(IntPtr windowHandle) { WindowHandle = windowHandle; }
        public IntPtr WindowHandle { get; }
    }

    /// <summary>An expected failure whose message can be shown to the user as-is.</summary>
    public sealed class HostOperationException : Exception
    {
        public HostOperationException(string message) : base(message) { }
        public HostOperationException(string message, Exception inner) : base(message, inner) { }
    }

    /// <summary>
    /// Everything TeXture needs from an Office application. Implemented once per host
    /// (PowerPointAdapter / WordAdapter); all members are called on the Office UI thread.
    /// </summary>
    public interface IHostAdapter : IDisposable
    {
        HostKind Kind { get; }

        /// <summary>"ppt" or "word"; used for settings, logs and UI theming.</summary>
        string HostId { get; }

        event EventHandler<SelectionChangedEventArgs> SelectionChanged;

        /// <summary>The active document window changed.</summary>
        event EventHandler WindowActivated;

        /// <summary>Documents/windows were opened or closed (task panes of dead windows can be released).</summary>
        event EventHandler WindowsChanged;

        /// <summary>The active document window object (passed to CustomTaskPanes.Add), or null.</summary>
        object ActiveWindow { get; }

        IntPtr GetWindowHandle(object window);

        SelectionState GetSelection();

        InsertResult Insert(InsertRequest request);

        /// <summary>Moves keyboard focus back to the document; selects <paramref name="inserted"/> when given.</summary>
        void ReturnFocusToDocument(InsertResult inserted);
    }
}
