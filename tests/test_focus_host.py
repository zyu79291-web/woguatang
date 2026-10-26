from pathlib import Path
import importlib.util,io,json,struct,subprocess,tempfile,unittest
HOST=Path(__file__).resolve().parents[1]/'focus/native/native_host.py'
spec=importlib.util.spec_from_file_location('focus_host',HOST);host=importlib.util.module_from_spec(spec);spec.loader.exec_module(host)

def frame(value):
 data=json.dumps(value).encode();return struct.pack('=I',len(data))+data
class FocusHostTests(unittest.TestCase):
 def test_native_framing(self):
  self.assertEqual(host.receive(io.BytesIO(frame({'type':'status','id':2}))),{'type':'status','id':2})
  self.assertIsNone(host.receive(io.BytesIO()))
  for data in [b'x',struct.pack('=I',100000),struct.pack('=I',9)+b'{}',frame([])]:
   with self.assertRaises(ValueError):host.receive(io.BytesIO(data))
 def test_state_can_be_ended(self):
  with tempfile.TemporaryDirectory() as temp:
   old=(host.RUNTIME,host.STATE);host.RUNTIME=Path(temp);host.STATE=Path(temp)/'state.json'
   try:
    self.assertTrue(host.write_state(True)['enabled']);self.assertFalse(host.write_state(False,'manual')['enabled']);self.assertFalse(host.read_state()['enabled'])
   finally:host.RUNTIME,host.STATE=old
 def test_invalid_origin_rejected(self):
  result=subprocess.run([__import__('sys').executable,str(HOST),'chrome-extension://not-approved/'],input=frame({'type':'set','enabled':True}),capture_output=True,timeout=5)
  self.assertEqual(result.returncode,1);self.assertEqual(result.stdout,b'')
 def test_protocol_status_off_and_disconnect(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);native=root/'focus/native';native.mkdir(parents=True)
   import shutil
   shutil.copyfile(HOST,native/'native_host.py');(root/'focus/extension-id.txt').write_text('abcdefghijklmnopabcdefghijklmnop')
   payload=frame({'id':1,'type':'status'})+frame({'id':2,'type':'set','enabled':False})+frame({'id':3,'type':'run','command':'no'})
   result=subprocess.run([__import__('sys').executable,str(native/'native_host.py'),'chrome-extension://abcdefghijklmnopabcdefghijklmnop/'],input=payload,capture_output=True,timeout=5)
   self.assertEqual(result.returncode,0,result.stderr)
   stream=io.BytesIO(result.stdout);replies=[]
   while True:
    reply=host.receive(stream)
    if reply is None:break
    replies.append(reply)
   by_id={r['id']:r for r in replies if 'id' in r}
   self.assertFalse(by_id[1]['enabled']);self.assertFalse(by_id[2]['enabled']);self.assertIn('error',by_id[3])
   self.assertFalse(json.loads((root/'runtime/focus/state.json').read_text())['enabled'])
if __name__=='__main__':unittest.main()
