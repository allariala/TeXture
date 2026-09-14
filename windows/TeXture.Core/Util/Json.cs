using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Web.Script.Serialization;

namespace TeXture.Core.Util
{
    /// <summary>
    /// Thin wrapper over JavaScriptSerializer (ships with .NET Framework), so the add-ins carry no
    /// JSON package dependencies. Objects deserialize to Dictionary&lt;string, object&gt;, arrays to object[].
    /// </summary>
    public static class Json
    {
        private static JavaScriptSerializer Create() =>
            new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 256 };

        public static string Serialize(object value) => Create().Serialize(value);

        public static object Parse(string json) => string.IsNullOrWhiteSpace(json) ? null : Create().DeserializeObject(json);

        public static Dictionary<string, object> ParseObject(string json) => Parse(json) as Dictionary<string, object>;

        public static string GetString(this IDictionary<string, object> d, string key, string fallback = null)
        {
            if (d == null || !d.TryGetValue(key, out var v) || v == null) return fallback;
            return v as string ?? Convert.ToString(v, CultureInfo.InvariantCulture);
        }

        public static double? GetDouble(this IDictionary<string, object> d, string key)
        {
            if (d == null || !d.TryGetValue(key, out var v) || v == null) return null;
            try { return Convert.ToDouble(v, CultureInfo.InvariantCulture); }
            catch (FormatException) { return null; }
            catch (InvalidCastException) { return null; }
        }

        public static bool GetBool(this IDictionary<string, object> d, string key, bool fallback = false)
        {
            if (d == null || !d.TryGetValue(key, out var v) || v == null) return fallback;
            return v is bool b ? b : fallback;
        }

        public static Dictionary<string, object> GetObject(this IDictionary<string, object> d, string key)
        {
            if (d == null || !d.TryGetValue(key, out var v)) return null;
            return v as Dictionary<string, object>;
        }

        public static object[] GetArray(this IDictionary<string, object> d, string key)
        {
            if (d == null || !d.TryGetValue(key, out var v) || v == null) return null;
            if (v is object[] arr) return arr;
            if (v is ArrayList list) return list.ToArray();
            return null;
        }

        /// <summary>Recursively merges <paramref name="patch"/> into <paramref name="target"/>; a null value deletes the key.</summary>
        public static void DeepMerge(Dictionary<string, object> target, IDictionary<string, object> patch)
        {
            foreach (var kv in patch)
            {
                if (kv.Value == null) { target.Remove(kv.Key); continue; }
                if (kv.Value is Dictionary<string, object> child &&
                    target.TryGetValue(kv.Key, out var existing) && existing is Dictionary<string, object> existingChild)
                {
                    DeepMerge(existingChild, child);
                }
                else
                {
                    target[kv.Key] = kv.Value;
                }
            }
        }

        public static Dictionary<string, object> DeepClone(Dictionary<string, object> source) =>
            ParseObject(Serialize(source)) ?? new Dictionary<string, object>();
    }
}
