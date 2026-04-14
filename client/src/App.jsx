import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Student pages
import Join             from './pages/student/Join.jsx';
import CharacterCreate  from './pages/student/CharacterCreate.jsx';
import Game             from './pages/student/Game.jsx';
import PhaseTransition  from './pages/student/PhaseTransition.jsx';
import Outcome          from './pages/student/Outcome.jsx';

// Teacher pages
import TeacherLogin     from './pages/teacher/Login.jsx';
import Dashboard        from './pages/teacher/Dashboard.jsx';
import ClassView        from './pages/teacher/ClassView.jsx';
import SnapshotManager  from './pages/teacher/SnapshotManager.jsx';

function RequireStudentAuth({ children }) {
  const token = localStorage.getItem('life_rpg_token');
  const role  = localStorage.getItem('life_rpg_role');
  if (!token || role !== 'student') return <Navigate to="/student/join" replace />;
  return children;
}

function RequireTeacherAuth({ children }) {
  const token = localStorage.getItem('life_rpg_token');
  const role  = localStorage.getItem('life_rpg_role');
  if (!token || role !== 'teacher') return <Navigate to="/teacher/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root → student join */}
        <Route path="/" element={<Navigate to="/student/join" replace />} />

        {/* ── Student tree ── */}
        <Route path="/student/join"   element={<Join />} />
        <Route path="/student/create" element={<RequireStudentAuth><CharacterCreate /></RequireStudentAuth>} />
        <Route path="/student/game"   element={<RequireStudentAuth><Game /></RequireStudentAuth>} />
        <Route path="/student/transition" element={<RequireStudentAuth><PhaseTransition /></RequireStudentAuth>} />
        <Route path="/student/outcome"    element={<RequireStudentAuth><Outcome /></RequireStudentAuth>} />

        {/* ── Teacher tree ── */}
        <Route path="/teacher/login"    element={<TeacherLogin />} />
        <Route path="/teacher"          element={<RequireTeacherAuth><Dashboard /></RequireTeacherAuth>} />
        <Route path="/teacher/class/:id" element={<RequireTeacherAuth><ClassView /></RequireTeacherAuth>} />
        <Route path="/teacher/class/:id/snapshot" element={<RequireTeacherAuth><SnapshotManager /></RequireTeacherAuth>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
