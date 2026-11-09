/* A separate thread keeps Python timeouts and Stop effective even for an infinite loop. */
let python;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{importScripts(data.base+'pyodide.js');python=await loadPyodide({indexURL:data.base});self.postMessage({type:'ready'});}
    catch(error){self.postMessage({type:'init-error',error:String(error.message||error)});}
    return;
  }
  if(data.type!=='run')return;
  try{
    python.globals.set('__cl_stdin',data.stdin);python.globals.set('__cl_code',data.code);
    const value=await python.runPythonAsync(`import sys, io, traceback, contextlib, ast, inspect
__cl_previous_stdin = sys.stdin
__cl_output, __cl_error = io.StringIO(), io.StringIO()
try:
    sys.stdin = io.StringIO(__cl_stdin)
    with contextlib.redirect_stdout(__cl_output), contextlib.redirect_stderr(__cl_error):
        try:
            __cl_result = eval(compile(__cl_code, '<user>', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT), {'__name__': '__main__'})
            if inspect.isawaitable(__cl_result):
                await __cl_result
        except SystemExit:
            pass
        except BaseException:
            traceback.print_exc()
finally:
    sys.stdin = __cl_previous_stdin
(__cl_output.getvalue(), __cl_error.getvalue())`);
    const result=value.toJs();value.destroy();self.postMessage({type:'result',id:data.id,stdout:result[0],stderr:result[1]});
  }catch(error){self.postMessage({type:'result',id:data.id,stdout:'',stderr:String(error.stack||error)});}
};
